const User = require('../models/User');

const userController = {
    async getProfile(req, res){
        try {
            // Check if req.user exists
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required - user not in request'
                });
            }
            
            
            // Try to find user ID from different possible fields
            const userId = req.user.id || req.user._id || req.user.userId || req.user.sub;
            
            if (!userId) {
                console.log('No user ID found in token payload. Available fields:', Object.keys(req.user));
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required - missing user ID'
                });
            }
            
            console.log('Attempting to find user with ID:', userId);
            
            // Find user by ID from token
            const user = await User.findById(userId);
            if (!user) {
                console.log('User not found in database with ID:', userId);
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found in database' 
                });
            }
            
            // Return formatted response according to API docs
            res.json({
                success: true,
                data: user,
            });
        } catch (error) {
            console.error('Error in getProfile:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Server error: ' + error.message
            });
        }
    },

    async getAllUsers(req, res) {
        try {
            const users = await User.find();
            res.json(users);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }           
    },

    async getUserById(req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ message: 'User not found' });
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Update user profile
    async updateProfile(req, res){
        try {
            const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });
            if (!user) return res.status(404).json({ message: 'User not found' });
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    },

        // Delete user account
    async deleteAccount(req, res) {
        try {
            await User.findByIdAndDelete(req.user.id);
            res.json({ message: 'User account deleted' });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    },
}

module.exports = userController;

