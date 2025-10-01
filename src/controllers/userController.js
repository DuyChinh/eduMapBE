const { get } = require("mongoose");


const userController = {
    async getProfile(req, res){
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
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

