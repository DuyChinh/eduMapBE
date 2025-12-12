const FeedPost = require('../models/FeedPost');
const Class = require('../models/Class');

const feedController = {
    // Get all posts for a class
    getPosts: async (req, res) => {
        try {
            const { classId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const posts = await FeedPost.find({ classId })
                .populate('author', 'name avatar email')
                .populate('comments.author', 'name avatar')
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
                .populate('author', 'name avatar email')
                .populate('comments.author', 'name avatar');

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
            const { content, images, isLocked } = req.body;
            const userId = req.user.id; // User from auth middleware

            if (req.user.role === 'student') {
                return res.status(403).json({ message: 'Only teachers can create posts' });
            }

            const newPost = await FeedPost.create({
                classId,
                author: userId,
                content,
                images: images || [],
                isLocked: !!isLocked
            });

            await newPost.populate('author', 'name avatar email');

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
            const userId = req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Check if user is author or teacher (TODO: Check if user is teacher of the class)
            if (post.author.toString() !== userId) {
                // Allow teacher of the class to delete
                const classData = await Class.findById(post.classId);
                if (!classData || classData.teacherId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
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
            const userId = req.user.id;

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
            const { content } = req.body;
            const userId = req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            if (post.isLocked) {
                return res.status(403).json({ message: 'Comments are locked for this post' });
            }

            const newComment = {
                author: userId,
                content
            };

            post.comments.push(newComment);
            await post.save();

            // Return the last added comment with populated author
            const updatedPost = await FeedPost.findById(postId).populate('comments.author', 'name avatar');
            const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

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
            const userId = req.user.id;

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
            const { content } = req.body;
            const userId = req.user.id;

            const post = await FeedPost.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found' });

            const comment = post.comments.id(commentId);
            if (!comment) return res.status(404).json({ message: 'Comment not found' });

            // Only author can update comment
            if (comment.author.toString() !== userId) {
                return res.status(403).json({ message: 'Not authorized' });
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
