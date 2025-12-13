const Notification = require('../models/Notification');

const notificationController = {
    // Get my notifications
    getMyNotifications: async (req, res) => {
        try {


            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const notifications = await Notification.find({ recipient: req.user.userId || req.user.id })
                .populate('sender', 'name avatar profile')
                .populate('classId', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            const total = await Notification.countDocuments({ recipient: req.user.userId || req.user.id });
            const unreadCount = await Notification.countDocuments({ recipient: req.user.userId || req.user.id, isRead: false });

            res.json({
                notifications,
                total,
                unreadCount,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            console.error('Error getting notifications:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Mark specific notification as read
    markAsRead: async (req, res) => {
        try {
            const { id } = req.params;
            await Notification.findOneAndUpdate(
                { _id: id, recipient: req.user.userId || req.user.id },
                { isRead: true }
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Mark all as read
    markAllAsRead: async (req, res) => {
        try {
            await Notification.updateMany(
                { recipient: req.user.userId || req.user.id, isRead: false },
                { isRead: true }
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking all as read:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = notificationController;
