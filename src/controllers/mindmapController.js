const Mindmap = require('../models/Mindmap');
const User = require('../models/User');
const crypto = require('crypto');
const { generateResponse } = require('../services/aiService');
const { deleteImageInternal, getPublicIdFromUrl } = require('./uploadController');

const mindmapController = {
    async create(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const { title, desc, data } = req.body;

            const newMindmap = new Mindmap({
                _id: crypto.randomUUID(),
                user_id: userId,
                title: title || 'Untitled Mindmap',
                desc: desc || '',
                data: data || {},
                status: true,
                favorite: false,
                shared_with: [],
                is_public: false,
                share_link: null
            });

            await newMindmap.save();

            res.status(201).json({
                success: true,
                data: newMindmap
            });
        } catch (error) {
            console.error('Error creating mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async getAll(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmaps = await Mindmap.find({ user_id: userId, deleted_at: null })
                .sort({ updated_at: -1 });

            res.json({
                success: true,
                data: mindmaps
            });
        } catch (error) {
            console.error('Error fetching mindmaps:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async getOne(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            // Check if user owns the mindmap or has been shared
            let mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                // Check if shared with user
                mindmap = await Mindmap.findOne({
                    _id: id,
                    deleted_at: null,
                    'shared_with.user_id': userId
                });
            }

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

            // Get owner info
            const owner = await User.findById(mindmap.user_id).select('name email profile');

            res.json({
                success: true,
                data: {
                    ...mindmap.toObject(),
                    owner: owner ? { name: owner.name, email: owner.email, avatar: owner.profile?.avatar } : null,
                    isOwner: mindmap.user_id === userId
                }
            });
        } catch (error) {
            console.error('Error fetching mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const updates = req.body;

            // Check ownership or edit permission
            let mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                // Check if has edit permission
                mindmap = await Mindmap.findOne({
                    _id: id,
                    deleted_at: null,
                    'shared_with': { $elemMatch: { user_id: userId, permission: 'edit' } }
                });
            }

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or no edit permission'
                });
            }

            const updatedMindmap = await Mindmap.findByIdAndUpdate(
                id,
                { ...updates, updated_at: new Date() },
                { new: true }
            );

            res.json({
                success: true,
                data: updatedMindmap
            });
        } catch (error) {
            console.error('Error updating mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmap = await Mindmap.findOneAndUpdate(
                { _id: id, user_id: userId },
                { deleted_at: new Date() },
                { new: true }
            );

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

            res.json({
                success: true,
                message: 'Mindmap deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async getTrash(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmaps = await Mindmap.find({ user_id: userId, deleted_at: { $ne: null } })
                .sort({ deleted_at: -1 });

            res.json({
                success: true,
                data: mindmaps
            });
        } catch (error) {
            console.error('Error fetching trash:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async restore(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmap = await Mindmap.findOneAndUpdate(
                { _id: id, user_id: userId },
                { deleted_at: null },
                { new: true }
            );

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

            res.json({
                success: true,
                message: 'Mindmap restored successfully',
                data: mindmap
            });
        } catch (error) {
            console.error('Error restoring mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    async permanentDelete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            // Find mindmap first to get data for cleanup
            const mindmapToDelete = await Mindmap.findOne({ _id: id, user_id: userId });

            if (!mindmapToDelete) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

            // Cleanup Cloudinary images used in mindmap nodes
            try {
                if (mindmapToDelete.data && mindmapToDelete.data.nodeData) {
                    const nodes = [mindmapToDelete.data.nodeData];
                    // Traverse all nodes using a stack
                    const stack = [mindmapToDelete.data.nodeData];

                    while (stack.length > 0) {
                        const node = stack.pop();

                        // Check if node has image
                        if (node.image && node.image.url) {
                            const publicId = getPublicIdFromUrl(node.image.url);
                            if (publicId) {
                                await deleteImageInternal(publicId).catch(err =>
                                    console.error(`Failed to delete mindmap image ${publicId}:`, err)
                                );
                            }
                        }

                        // Add children to stack
                        if (node.children && node.children.length > 0) {
                            stack.push(...node.children);
                        }
                    }
                }
            } catch (cleanupError) {
                console.error('Error cleaning up mindmap images:', cleanupError);
                // Continue with deletion even if cleanup fails
            }

            const mindmap = await Mindmap.findOneAndDelete({ _id: id, user_id: userId });

            res.json({
                success: true,
                message: 'Mindmap permanently deleted'
            });
        } catch (error) {
            console.error('Error permanently deleting mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Get mindmaps shared with current user
    async getShared(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmaps = await Mindmap.find({
                deleted_at: null,
                'shared_with.user_id': userId
            }).sort({ updated_at: -1 });

            // Get owner info for each mindmap
            const mindmapsWithOwners = await Promise.all(mindmaps.map(async (mindmap) => {
                const owner = await User.findById(mindmap.user_id).select('name email profile');
                const shareInfo = mindmap.shared_with.find(s => s.user_id === userId);
                return {
                    ...mindmap.toObject(),
                    owner: owner ? { name: owner.name, email: owner.email, avatar: owner.profile?.avatar } : null,
                    myPermission: shareInfo?.permission || 'view',
                    sharedAt: shareInfo?.shared_at
                };
            }));

            res.json({
                success: true,
                data: mindmapsWithOwners
            });
        } catch (error) {
            console.error('Error fetching shared mindmaps:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Share mindmap with another user
    async shareMindmap(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const { email, permission = 'view' } = req.body;

            // Check ownership
            const mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or access denied'
                });
            }

            // Find user by email
            const targetUser = await User.findOne({ email: email.toLowerCase() });

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found with this email'
                });
            }

            // Cannot share with yourself
            if (targetUser._id.toString() === userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot share with yourself'
                });
            }

            // Check if already shared
            const existingShare = mindmap.shared_with.find(s => s.user_id === targetUser._id.toString());

            if (existingShare) {
                // Update permission
                existingShare.permission = permission;
            } else {
                // Add new share
                mindmap.shared_with.push({
                    user_id: targetUser._id.toString(),
                    email: targetUser.email,
                    permission: permission,
                    shared_at: new Date()
                });
            }

            await mindmap.save();

            // Create notification for recipient
            const Notification = require('../models/Notification');
            await Notification.create({
                recipient: targetUser._id,
                sender: userId,
                type: 'MINDMAP_SHARED',
                content: 'MINDMAP_SHARED',
                relatedId: mindmap._id,
                onModel: 'Mindmap' // We need to update Notification model enum if 'Mindmap' is not in allowed values for relatedModel/onModel? 
                                   // The model says: enum: ['FeedPost', 'Class']. We need to update that too.
            });

            res.json({
                success: true,
                message: `Mindmap shared with ${email}`,
                data: {
                    shared_with: mindmap.shared_with
                }
            });
        } catch (error) {
            console.error('Error sharing mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Remove share from user
    async unshareMindmap(req, res) {
        try {
            const { id, shareUserId } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or access denied'
                });
            }

            mindmap.shared_with = mindmap.shared_with.filter(s => s.user_id !== shareUserId);
            await mindmap.save();

            res.json({
                success: true,
                message: 'Share removed successfully',
                data: {
                    shared_with: mindmap.shared_with
                }
            });
        } catch (error) {
            console.error('Error removing share:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Toggle public share link
    async togglePublic(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const { is_public, permission = 'view' } = req.body;

            const mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or access denied'
                });
            }

            // If is_public is provided, use it; otherwise toggle
            if (typeof is_public === 'boolean') {
                mindmap.is_public = is_public;
            } else {
                mindmap.is_public = !mindmap.is_public;
            }

            // Update permission if provided
            if (permission && ['view', 'edit'].includes(permission)) {
                mindmap.public_permission = permission;
            }

            if (mindmap.is_public && !mindmap.share_link) {
                mindmap.share_link = crypto.randomBytes(16).toString('hex');
            }

            await mindmap.save();

            res.json({
                success: true,
                data: {
                    is_public: mindmap.is_public,
                    share_link: mindmap.is_public ? mindmap.share_link : null,
                    public_permission: mindmap.public_permission || 'view'
                }
            });
        } catch (error) {
            console.error('Error toggling public:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Get mindmap by public share link (no auth required)
    async getByShareLink(req, res) {
        try {
            const { shareLink } = req.params;

            const mindmap = await Mindmap.findOne({
                share_link: shareLink,
                is_public: true,
                deleted_at: null
            });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or link expired'
                });
            }

            const owner = await User.findById(mindmap.user_id).select('name email profile');

            res.json({
                success: true,
                data: {
                    _id: mindmap._id,
                    title: mindmap.title,
                    desc: mindmap.desc,
                    data: mindmap.data,
                    owner: owner ? { name: owner.name, avatar: owner.profile?.avatar } : null,
                    isPublic: true,
                    public_permission: mindmap.public_permission || 'view'
                }
            });
        } catch (error) {
            console.error('Error fetching shared mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Update mindmap by public share link (no auth required, but checks public_permission)
    async updateByShareLink(req, res) {
        try {
            const { shareLink } = req.params;
            const { data } = req.body;

            const mindmap = await Mindmap.findOne({
                share_link: shareLink,
                is_public: true,
                deleted_at: null
            });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or link expired'
                });
            }

            // Check if public permission allows editing
            if (mindmap.public_permission !== 'edit') {
                return res.status(403).json({
                    success: false,
                    message: 'This mindmap is view-only. Editing is not allowed.'
                });
            }

            // Update mindmap data
            if (data) {
                mindmap.data = data;
            }

            await mindmap.save();

            res.json({
                success: true,
                message: 'Mindmap updated successfully',
                data: {
                    _id: mindmap._id,
                    title: mindmap.title,
                    data: mindmap.data
                }
            });
        } catch (error) {
            console.error('Error updating shared mindmap:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Get share info for a mindmap
    async getShareInfo(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;

            const mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found or access denied'
                });
            }

            res.json({
                success: true,
                data: {
                    shared_with: mindmap.shared_with,
                    is_public: mindmap.is_public,
                    share_link: mindmap.is_public ? mindmap.share_link : null,
                    public_permission: mindmap.public_permission || 'view'
                }
            });
        } catch (error) {
            console.error('Error fetching share info:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    },

    // Generate mindmap with AI
    async generateWithAI(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const { prompt, title } = req.body;

            if (!prompt || !prompt.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Prompt is required'
                });
            }

            // Create prompt for AI to generate mindmap structure
            const aiPrompt = `Bạn là một chuyên gia tạo mindmap. Hãy tạo một mindmap dựa trên yêu cầu sau:

"${prompt}"

Yêu cầu:
1. Tạo một mindmap có cấu trúc phân cấp rõ ràng với root node và các child nodes
2. Root node nên là chủ đề chính
3. Tạo ít nhất 3-5 nhánh chính từ root node
4. Mỗi nhánh chính có thể có 2-4 nhánh con
5. Sử dụng tiếng Việt nếu prompt là tiếng Việt, tiếng Anh nếu prompt là tiếng Anh

Trả về JSON với format chính xác sau (KHÔNG thêm text giải thích, CHỈ trả về JSON):

{
  "nodeData": {
    "id": "root",
    "topic": "Tên chủ đề chính",
    "root": true,
    "children": [
      {
        "id": "node1",
        "topic": "Nhánh 1",
        "children": [
          {
            "id": "node1-1",
            "topic": "Nhánh con 1-1"
          },
          {
            "id": "node1-2",
            "topic": "Nhánh con 1-2"
          }
        ]
      },
      {
        "id": "node2",
        "topic": "Nhánh 2",
        "children": []
      }
    ]
  },
  "arrows": [],
  "summaries": [],
  "direction": 2,
  "theme": {
    "name": "Custom",
    "palette": ["#FF5722", "#FFC107", "#8BC34A", "#03A9F4", "#9C27B0", "#009688", "#E91E63", "#3F51B5"],
    "cssVar": {
      "--main-color": "#444446",
      "--main-bgcolor": "#ffffff",
      "--color": "#777777",
      "--bgcolor": "#f6f6f6",
      "--panel-color": "#444446",
      "--panel-bgcolor": "#ffffff",
      "--root-color": "#ffffff",
      "--root-bgcolor": "#2c3e50",
      "--root-radius": "5px",
      "--main-radius": "5px",
      "--main-gap-x": "30px",
      "--main-gap-y": "30px",
      "--node-gap-x": "30px",
      "--node-gap-y": "30px"
    }
  }
}

Lưu ý:
- Mỗi node phải có id duy nhất
- Root node luôn có id="root" và root=true
- Chỉ trả về JSON, không thêm markdown code block hoặc text khác`;

            console.log('Generating mindmap with AI...');
            const aiResponse = await generateResponse(aiPrompt);

            // Extract JSON from response
            let mindmapData;
            try {
                // Try to find JSON in response (might be wrapped in markdown code blocks)
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('AI response không chứa JSON hợp lệ');
                }

                mindmapData = JSON.parse(jsonMatch[0]);

                // Validate structure
                if (!mindmapData.nodeData || !mindmapData.nodeData.id) {
                    throw new Error('Mindmap data không hợp lệ: thiếu nodeData');
                }

                // Ensure root node has correct properties
                if (mindmapData.nodeData.id !== 'root') {
                    mindmapData.nodeData.id = 'root';
                }
                mindmapData.nodeData.root = true;

                // Ensure arrays exist
                if (!mindmapData.arrows) mindmapData.arrows = [];
                if (!mindmapData.summaries) mindmapData.summaries = [];
                if (mindmapData.direction === undefined) mindmapData.direction = 2; // SIDE (balanced)

                // Ensure theme exists
                if (!mindmapData.theme) {
                    mindmapData.theme = {
                        name: "Custom",
                        palette: ["#FF5722", "#FFC107", "#8BC34A", "#03A9F4", "#9C27B0", "#009688", "#E91E63", "#3F51B5"],
                        cssVar: {
                            "--main-color": "#444446",
                            "--main-bgcolor": "#ffffff",
                            "--color": "#777777",
                            "--bgcolor": "#f6f6f6",
                            "--panel-color": "#444446",
                            "--panel-bgcolor": "#ffffff",
                            "--root-color": "#ffffff",
                            "--root-bgcolor": "#2c3e50",
                            "--root-radius": "5px",
                            "--main-radius": "5px",
                            "--main-gap-x": "30px",
                            "--main-gap-y": "30px",
                            "--node-gap-x": "30px",
                            "--node-gap-y": "30px"
                        }
                    };
                }

            } catch (parseError) {
                console.error('Error parsing AI response:', parseError);
                console.error('AI Response:', aiResponse);
                return res.status(500).json({
                    success: false,
                    message: 'Không thể parse mindmap từ AI response: ' + parseError.message
                });
            }

            // Create mindmap with AI-generated data
            const newMindmap = new Mindmap({
                _id: crypto.randomUUID(),
                user_id: userId,
                title: title || mindmapData.nodeData.topic || 'AI Generated Mindmap',
                desc: `Generated with AI: ${prompt.substring(0, 100)}`,
                data: mindmapData,
                status: true,
                favorite: false,
                shared_with: [],
                is_public: false,
                share_link: null
            });

            await newMindmap.save();

            res.status(201).json({
                success: true,
                data: newMindmap
            });
        } catch (error) {
            console.error('Error generating mindmap with AI:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message
            });
        }
    }
};

module.exports = mindmapController;

