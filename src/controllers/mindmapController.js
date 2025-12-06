const Mindmap = require('../models/Mindmap');
const crypto = require('crypto');

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
                favorite: false
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

            const mindmap = await Mindmap.findOne({ _id: id, user_id: userId, deleted_at: null });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

            res.json({
                success: true,
                data: mindmap
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

            const mindmap = await Mindmap.findOneAndUpdate(
                { _id: id, user_id: userId, deleted_at: null },
                { ...updates, updated_at: new Date() },
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
                data: mindmap
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

            const mindmap = await Mindmap.findOneAndDelete({ _id: id, user_id: userId });

            if (!mindmap) {
                return res.status(404).json({
                    success: false,
                    message: 'Mindmap not found'
                });
            }

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
    }
};

module.exports = mindmapController;
