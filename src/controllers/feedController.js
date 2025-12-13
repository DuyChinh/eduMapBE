const FeedPost = require('../models/FeedPost');
const Class = require('../models/Class');
const User = require('../models/User');
const Notification = require('../models/Notification');
const cloudinary = require('../config/cloudinary');

const feedController = {
    // Get all posts for a class
    getPosts: async (req, res) => {
        try {
            const { classId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const posts = await FeedPost.find({ classId })
                .populate('author', 'name profile email')
                .populate('comments.author', 'name profile')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const total = await FeedPost.countDocuments({ classId });

            res.json({
                posts,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page)
            });
        } catch (error) {
            console.error('Error getting posts:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get single post
    getPost: async (req, res) => {
        try {
            const { postId } = req.params;
            const post = await FeedPost.findById(postId)
                .populate('author', 'name profile email')
                .populate('comments.author', 'name profile');

            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            res.json(post);
        } catch (error) {
            console.error('Error getting post:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Create a new post
    createPost: async (req, res) => {
        try {
            const { classId } = req.params;
            const { content, images, files, links, isLocked } = req.body;
            const userId = req.user.userId || req.user.id; // User from auth middleware

            if (req.user.role === 'student') {
                return res.status(403).json({ message: 'Only teachers can create posts' });
            }

            const newPost = await FeedPost.create({
                classId,
                author: userId,
                content,
                images: images || [],
                files: files || [],
                links: links || [],
                isLocked: !!isLocked
            });

            await newPost.populate('author', 'name profile email');

            // Create notification for all students
            try {
                const classData = await Class.findById(classId);
                if (classData) {
                    let recipientIds = [];
                    if (classData.studentIds) recipientIds.push(...classData.studentIds);
                    if (classData.studentJoins) recipientIds.push(...classData.studentJoins.map(s => s.studentId));

                    const uniqueRecipients = [...new Set(recipientIds.map(id => id.toString()))]
                        .filter(id => id !== userId.toString());

                    // DEBUG LOGGING
                    try {
                        const fs = require('fs');
                        const logPath = require('path').join(__dirname, '../../debug_log.txt');
                        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] CreatePost Recipients:\n`);
                        fs.appendFileSync(logPath, `ClassId: ${classId}\n`);
                        fs.appendFileSync(logPath, `Sender: ${userId}\n`);
                        fs.appendFileSync(logPath, `Recipients: ${JSON.stringify(uniqueRecipients)}\n`);
                    } catch (e) { }

                    if (uniqueRecipients.length > 0) {
                        const notifications = uniqueRecipients.map(studentId => ({
                            recipient: studentId,
                            sender: userId,
                            classId: classId,
                            type: 'NEW_POST',
                            content: 'NOTIFICATION_NEW_POST',
                            relatedId: newPost._id,
                            onModel: 'FeedPost'
                        }));
                        await Notification.insertMany(notifications);
                    }
                }
            } catch (error) {
                console.error('Error creating notifications:', error);
            }

            res.status(201).json(newPost);
        } catch (error) {
            console.error('Error creating post:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Delete a post
    deletePost: async (req, res) => {
        try {
            const { postId } = req.params;
            const userId = req.user.userId || req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            if (post.author.toString() !== userId) {
                // Allow teacher of the class to delete
                const classData = await Class.findById(post.classId);
                if (!classData || classData.teacherId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
            }

            // Delete images and files from Cloudinary
            if (post.images && post.images.length > 0) {
                const imagePublicIds = post.images.map(url => {
                    const parts = url.split('/upload/');
                    if (parts.length < 2) return null;
                    let path = parts[1].replace(/^v\d+\//, '');
                    return path.substring(0, path.lastIndexOf('.'));
                }).filter(id => id);

                if (imagePublicIds.length > 0) {
                    imagePublicIds.forEach(id => cloudinary.uploader.destroy(id));
                }
            }

            if (post.files && post.files.length > 0) {
                post.files.forEach(file => {
                    if (file.url) {
                        const parts = file.url.split('/upload/');
                        if (parts.length >= 2) {
                            let publicId = parts[1].replace(/^v\d+\//, '');
                            cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
                        }
                    }
                });
            }

            // Clean up attachments in COMMENTS
            if (post.comments && post.comments.length > 0) {
                post.comments.forEach(comment => {
                    // Delete comment images
                    if (comment.images && comment.images.length > 0) {
                        comment.images.forEach(url => {
                            try {
                                const parts = url.split('/upload/');
                                if (parts.length >= 2) {
                                    let path = parts[1].replace(/^v\d+\//, '');
                                    // Remove extension for images as per standard logic
                                    const publicId = path.substring(0, path.lastIndexOf('.'));
                                    cloudinary.uploader.destroy(publicId);
                                }
                            } catch (err) {
                                console.error('Error deleting comment image:', err);
                            }
                        });
                    }

                    // Delete comment files
                    if (comment.files && comment.files.length > 0) {
                        comment.files.forEach(file => {
                            if (file.url) {
                                try {
                                    const parts = file.url.split('/upload/');
                                    if (parts.length >= 2) {
                                        // Handle potential fl_attachment injection if strictly following new frontend logic
                                        // But URL stored in DB is usually clean. If not, handle it.
                                        // Standard storage URL: .../upload/v123/files/name
                                        let cleanUrlPart = parts[1].replace('fl_attachment/', '');
                                        let publicId = cleanUrlPart.replace(/^v\d+\//, '');

                                        // If stored with extension (old way), destroy might need handling.
                                        // But 'raw' usually takes exact public_id.
                                        // Current strategy saves without extension for download-hack.

                                        cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
                                    }
                                } catch (err) {
                                    console.error('Error deleting comment file:', err);
                                }
                            }
                        });
                    }
                });
            }

            await FeedPost.findByIdAndDelete(postId);
            res.json({ message: 'Post deleted successfully' });
        } catch (error) {
            console.error('Error deleting post:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Toggle like
    toggleLike: async (req, res) => {
        try {
            const { postId } = req.params;
            const userId = req.user.userId || req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const likeIndex = post.likes.indexOf(userId);
            if (likeIndex === -1) {
                post.likes.push(userId);
            } else {
                post.likes.splice(likeIndex, 1);
            }

            await post.save();
            res.json(post.likes);
        } catch (error) {
            console.error('Error toggling like:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Add comment
    addComment: async (req, res) => {
        try {
            const { postId } = req.params;
            const { content, images, files, links } = req.body;
            const userId = req.user.userId || req.user.id;

            // Validation: Must have at least one of: content, images, files, or links
            const hasContent = content && content.trim().length > 0;
            const hasAttachments = (images && images.length > 0) || (files && files.length > 0) || (links && links.length > 0);

            if (!hasContent && !hasAttachments) {
                return res.status(400).json({ message: 'Comment cannot be empty' });
            }

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            if (post.isLocked) {
                return res.status(403).json({ message: 'Comments are locked for this post' });
            }

            // Check if user is still a member of the class
            const classData = await Class.findById(post.classId);
            if (!classData) {
                return res.status(404).json({ message: 'Class not found' });
            }

            const isTeacher = String(classData.teacherId) === String(userId);
            const isStudent = classData.studentIds.some(sid =>
                String(sid._id || sid) === String(userId)
            );

            if (!isTeacher && !isStudent && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'You are no longer a member of this class' });
            }

            const newComment = {
                author: userId,
                content,
                images: images || [],
                files: files || [],
                links: links || []
            };

            post.comments.push(newComment);
            await post.save();

            // Return the last added comment with populated author
            const updatedPost = await FeedPost.findById(postId).populate('comments.author', 'name profile');
            const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

            // Create notification for class members (Teacher + Students)
            try {
                let recipientIds = [];
                if (classData.teacherId) recipientIds.push(classData.teacherId);
                if (classData.studentIds) recipientIds.push(...classData.studentIds);
                if (classData.studentJoins) recipientIds.push(...classData.studentJoins.map(s => s.studentId));

                // Deduplicate and remove commenter (userId)
                const uniqueRecipients = [...new Set(recipientIds.map(id => id.toString()))]
                    .filter(id => id !== userId.toString());

                if (uniqueRecipients.length > 0) {
                    const notifications = uniqueRecipients.map(recipientId => ({
                        recipient: recipientId,
                        sender: userId,
                        classId: post.classId,
                        type: 'NEW_COMMENT',
                        content: recipientId === post.author.toString()
                            ? 'NOTIFICATION_NEW_COMMENT_OWN'
                            : 'NOTIFICATION_NEW_COMMENT_OTHER',
                        relatedId: postId,
                        onModel: 'FeedPost'
                    }));
                    await Notification.insertMany(notifications);
                }
            } catch (error) {
                console.error('Error creating notification:', error);
            }

            res.status(201).json(addedComment);
        } catch (error) {
            console.error('Error adding comment:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Delete comment
    deleteComment: async (req, res) => {
        try {
            const { postId, commentId } = req.params;
            const userId = req.user.userId || req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const comment = post.comments.id(commentId);
            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            // Authorization:
            const isCommentAuthor = comment.author.toString() === userId;

            const isPostAuthor = post.author.toString() === userId;

            if (!isCommentAuthor && !isPostAuthor) {
                const classData = await Class.findById(post.classId);
                const isClassTeacher = classData && classData.teacherId.toString() === userId;

                if (!isClassTeacher) {
                    return res.status(403).json({ message: 'Not authorized to delete this comment' });
                }
            }

            // Clean up Cloudinary assets
            if (comment.images && comment.images.length > 0) {
                const imagePublicIds = comment.images.map(url => {
                    const parts = url.split('/upload/');
                    if (parts.length < 2) return null;
                    let path = parts[1].replace(/^v\d+\//, '');
                    return path.substring(0, path.lastIndexOf('.'));
                }).filter(id => id);

                if (imagePublicIds.length > 0) {
                    imagePublicIds.forEach(id => cloudinary.uploader.destroy(id));
                }
            }

            if (comment.files && comment.files.length > 0) {
                comment.files.forEach(file => {
                    if (file.url) {
                        const parts = file.url.split('/upload/');
                        if (parts.length >= 2) {
                            let publicId = parts[1].replace(/^v\d+\//, '');
                            cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
                        }
                    }
                });
            }

            comment.deleteOne();
            await post.save();

            res.json({ message: 'Comment deleted' });
        } catch (error) {
            console.error('Error deleting comment:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update Comment
    updateComment: async (req, res) => {
        try {
            const { postId, commentId } = req.params;
            const { content, images, files, links } = req.body;
            const userId = req.user.id;

            // Validation: Must have at least one of: content, images, files, or links
            // Note: If fields are undefined, we usually keep old values, but here we assume full update payload or partials.
            // A simplified check: if user sends specific fields, check resulting state. 
            // However, simpler is to just check if the request attempts to set everything to empty.

            const hasContent = content !== undefined ? content.trim().length > 0 : true; // If not provided, assume ok (or handle differently)
            // Actually, better to just check if the intended new state is valid. 
            // But since this is specific to the "empty comment" bug:

            if (content !== undefined && content.trim() === '' &&
                (!images || images.length === 0) &&
                (!files || files.length === 0) &&
                (!links || links.length === 0)) {
                // Check if existing attachments are being removed... 
                // For simplicity, let's just apply the same check as addComment if content is explicitly sent as empty
                if ((!images || images.length === 0) && (!files || files.length === 0) && (!links || links.length === 0))
                    return res.status(400).json({ message: 'Comment cannot be empty' });
            }

            const post = await FeedPost.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found' });

            const comment = post.comments.id(commentId);
            if (!comment) return res.status(404).json({ message: 'Comment not found' });

            // Only author can update comment
            if (comment.author.toString() !== userId) {
                return res.status(403).json({ message: 'Not authorized' });
            }

            // Handle Images cleanup
            if (images !== undefined) {
                const deletedImages = comment.images.filter(oldUrl => !images.includes(oldUrl));
                if (deletedImages.length > 0) {
                    deletedImages.forEach(url => {
                        const parts = url.split('/upload/');
                        if (parts.length >= 2) {
                            let path = parts[1].replace(/^v\d+\//, '');
                            let publicId = path.substring(0, path.lastIndexOf('.'));
                            cloudinary.uploader.destroy(publicId);
                        }
                    });
                }
                comment.images = images;
            }

            // Handle Files cleanup
            if (files !== undefined) {
                const newFileUrls = files.map(f => f.url);
                const deletedFiles = comment.files.filter(oldFile => !newFileUrls.includes(oldFile.url));
                if (deletedFiles.length > 0) {
                    deletedFiles.forEach(file => {
                        if (file.url) {
                            const parts = file.url.split('/upload/');
                            if (parts.length >= 2) {
                                let publicId = parts[1].replace(/^v\d+\//, '');
                                cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
                            }
                        }
                    });
                }
                comment.files = files;
            }

            if (links !== undefined) {
                comment.links = links;
            }

            comment.content = content;
            await post.save();

            // Return updated comment
            res.json(comment);
        } catch (error) {
            console.error('Error updating comment:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update Post
    updatePost: async (req, res) => {
        try {
            const { postId } = req.params;
            const { content } = req.body;
            const userId = req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found' });

            if (post.author.toString() !== userId) {
                return res.status(403).json({ message: 'Not authorized' });
            }

            post.content = content;
            await post.save();
            await post.populate('author', 'name avatar email');
            res.json(post);
        } catch (error) {
            console.error('Error updating post:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Toggle Lock
    toggleLock: async (req, res) => {
        try {
            const { postId } = req.params;
            const userId = req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found' });

            // Only author or Teacher can lock
            if (post.author.toString() !== userId) {
                const classData = await Class.findById(post.classId);
                if (!classData || classData.teacherId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
            }

            post.isLocked = !post.isLocked;
            await post.save();
            res.json({ isLocked: post.isLocked });
        } catch (error) {
            console.error('Error toggling lock:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = feedController;
