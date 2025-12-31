const User = require('../models/User');
const { sanitizeUser, sanitizeUsers } = require('../utils/userUtils');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const auditLogService = require('../services/auditLogService');

const userController = {
    async getProfile(req, res) {
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
    async updateProfile(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            // Check if avatar is being updated and old avatar is from Cloudinary
            // Handle both nested object and dot notation formats
            const newAvatar = req.body['profile.avatar'] || req.body.profile?.avatar;
            const oldAvatar = user.profile?.avatar;

            if (newAvatar && oldAvatar) {
                // Only delete if old avatar is from Cloudinary and different from new one
                if (oldAvatar !== newAvatar && oldAvatar.includes('cloudinary.com')) {
                    try {
                        // Extract public_id from Cloudinary URL
                        // URL format: https://res.cloudinary.com/[cloud]/image/upload/v[version]/[folder]/[public_id].[ext]
                        const urlParts = oldAvatar.split('/');
                        const fileWithExt = urlParts[urlParts.length - 1];
                        const fileName = fileWithExt.split('.')[0];
                        const folder = urlParts[urlParts.length - 2];
                        const publicId = folder !== 'upload' ? `${folder}/${fileName}` : fileName;

                        // Delete old image from Cloudinary
                        await cloudinary.uploader.destroy(publicId);
                    } catch (deleteError) {
                        console.error('Error deleting old avatar from Cloudinary:', deleteError);
                        // Continue with update even if deletion fails
                    }
                }
            }

            // Build update object with dot notation for nested fields
            const updateData = {};

            // Update simple fields
            if (req.body.name) updateData.name = req.body.name;
            if (req.body.email) updateData.email = req.body.email;
            if (req.body.role) updateData.role = req.body.role;
            if (req.body.status) updateData.status = req.body.status;
            if (req.body.language) updateData.language = req.body.language;

            // New fields
            if (req.body.dob) updateData.dob = req.body.dob;
            if (req.body.address) updateData.address = req.body.address;
            if (req.body.phone) updateData.phone = req.body.phone;

            // Backward compatibility for phone (if passed in profile.phone)
            const legacyPhone = req.body['profile.phone'] || (req.body.profile && req.body.profile.phone);
            if (legacyPhone && !updateData.phone) {
                updateData.phone = legacyPhone;
            }

            // Update nested profile fields using dot notation
            if (req.body['profile.avatar']) {
                updateData['profile.avatar'] = req.body['profile.avatar'];
            }
            if (req.body['profile.studentId']) {
                updateData['profile.studentId'] = req.body['profile.studentId'];
            }

            // If profile object is provided directly (for backward compatibility)
            if (req.body.profile && typeof req.body.profile === 'object') {
                if (req.body.profile.avatar !== undefined) {
                    updateData['profile.avatar'] = req.body.profile.avatar;
                }
                if (req.body.profile.studentId !== undefined) {
                    updateData['profile.studentId'] = req.body.profile.studentId;
                }
            }

            // Update user profile using dot notation to preserve other fields
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            // Audit log for user profile update
            await auditLogService.logUpdate('users', userId, { name: updatedUser.name, email: updatedUser.email }, req.user, req);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: sanitizeUser(updatedUser)
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                message: 'Server error: ' + error.message
            });
        }
    },

    // Delete user account
    async deleteAccount(req, res) {
        try {
            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            const user = await User.findByIdAndDelete(userId);

            // Audit log for user deletion
            if (user) {
                await auditLogService.logDelete('users', userId, { name: user.name, email: user.email }, req.user, req);
            }

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

    //Switch user role
    async switchMyRole(req, res) {
        try {
            const { role } = req.body;

            const validRoles = ['teacher', 'student'];
            if (!role || !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role. Must be one of: teacher, student',
                });
            }

            const userId = req.user.userId || req.user.id || req.user._id || req.user.sub;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            user.role = role;
            await user.save();

            const payload = {
                id: user._id,
                email: user.email,
                role: user.role,
            };

            // Tạo Access Token (ngắn hạn - 1h)
            const accessToken = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1h' }
            );

            // Tạo Refresh Token (dài hạn - 7d)
            const refreshToken = jwt.sign(
                { id: user._id, type: 'refresh' },
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
            );

            return res.json({
                success: true,
                message: 'Role switched successfully',
                data: {
                    user: sanitizeUser(user),
                    token: accessToken, // Backward compatibility
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                },
            });
        } catch (error) {
            console.error('Error switching user role:', error);
            res.status(500).json({
                success: false,
                message: 'Server error: ' + error.message,
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

            // Audit log for user role update
            await auditLogService.logUpdate('users', id, { name: user.name, email: user.email, role: user.role }, req.user, req);

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