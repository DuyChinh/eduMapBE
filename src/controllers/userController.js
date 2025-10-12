const User = require('../models/User');
const { sanitizeUser, sanitizeUsers } = require('../utils/userUtils');

const userController = {
    async getProfile(req, res){
        try {
            // Check if req.user exists
            if (!req.user) {
                return res.status(401).json({
                    message: 'Authentication required - user not in request'
                });
            }
            
            const userId = req.user.id || req.user._id || req.user.userId || req.user.sub;
            
            if (!userId) {
                console.log('No user ID found in token payload. Available fields:', Object.keys(req.user));
                return res.status(401).json({
                    message: 'Authentication required - missing user ID'
                });
            }
            
            console.log('Attempting to find user with ID:', userId);
            
            // Find user by ID from token
            const user = await User.findById(userId);
            if (!user) {
                console.log('User not found in database with ID:', userId);
                return res.status(404).json({ 
                    message: 'User not found in database' 
                });
            }
            
            // Return formatted response according to API docs
            res.json({
                success: true,
                data: sanitizeUser(user),
            });
        } catch (error) {
            console.error('Error in getProfile:', error);
            res.status(500).json({ 
                message: 'Server error: ' + error.message
            });
        }
    },

    async getAllUsers(req, res) {
        try {
            const users = await User.find();
            res.json({
                success: true,
                data: sanitizeUsers(users)
            });
        } catch (error) {
            res.status(500).json({ 
                message: 'Server error: ' + error.message 
            });
        }           
    },

    async getUserById(req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ 
                    message: 'User not found' 
                });
            }
            res.json({
                success: true,
                data: sanitizeUser(user)
            });
        } catch (error) {
            res.status(500).json({ 
                message: 'Server error: ' + error.message 
            });
        }
    },

    // Update user profile
    async updateProfile(req, res){
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const user = await User.findByIdAndUpdate(userId, req.body, { new: true });
            if (!user) {
                return res.status(404).json({ 
                    message: 'User not found' 
                });
            }
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: sanitizeUser(user)
            });
        } catch (error) {
            res.status(500).json({ 
                message: 'Server error: ' + error.message 
            });
        }
    },

        // Delete user account
    async deleteAccount(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            await User.findByIdAndDelete(userId);
            res.json({ 
                success: true,
                message: 'User account deleted successfully' 
            });
        } catch (error) {
            res.status(500).json({ 
                message: 'Server error: ' + error.message 
            });
        }
    },

    // Update user role (admin only)
    async updateUserRole(req, res) {
        try {
            const { id } = req.params;
            const { role } = req.body;

            // Validate role
            const validRoles = ['teacher', 'student'];
            if (!role || !validRoles.includes(role)) {
                return res.status(400).json({
                    message: 'Invalid role. Must be one of: teacher, student'
                });
            }

            // Find and update user
            const user = await User.findByIdAndUpdate(
                id, 
                { role }, 
                { new: true, runValidators: true }
            );

            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'User role updated successfully',
                data: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Error updating user role:', error);
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
        }
    },
}

module.exports = userController;

