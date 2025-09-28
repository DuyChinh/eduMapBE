# EduMapBack - Education Management System

This is a Node.js Express application for education management with online exam capabilities, built with MongoDB and designed for multi-tenant architecture.

## 🏗️ Project Structure

```
EduMapBack/
├── src/
│   ├── app.js                    # Entry point of the application
│   ├── controllers/              # Controller functions
│   ├── routes/                   # Application routes
│   ├── models/                   # Mongoose data models
│   │   ├── Organization.js       # Organization model
│   │   ├── User.js               # User model
│   │   ├── Class.js              # Class model
│   │   ├── Question.js           # Question model
│   │   ├── Exam.js               # Exam model
│   │   ├── Assignment.js         # Assignment model
│   │   ├── Submission.js         # Submission model
│   │   └── ProctorLog.js         # Proctor log model
│   ├── middleware/               # Middleware functions
│   ├── utils/                    # Utility functions
│   ├── config/                   # Configuration settings
│   ├── migrations/               # Database migrations
│   ├── seeders/                  # Database seeders
│   └── scripts/                  # Utility scripts
├── public/                       # Static files
├── views/                        # EJS template files
├── tests/                        # Test files
├── migrate-mongo-config.js       # Migration configuration
├── package.json                  # NPM configuration
├── .env                          # Environment variables
└── README.md                     # Project documentation
```

## 🚀 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd EduMapBack
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` file with your configuration:
   ```env
   # Database
   DATABASE_MG_URL=mongodb+srv://username:password@cluster.mongodb.net/edumap
   MIGRATE_MG_URL=mongodb+srv://username:password@cluster.mongodb.net/edumap
   
   # Server
   PORT=3000
   NODE_ENV=development
   
   # JWT
   JWT_SECRET=your_jwt_secret_here
   ```

## 🗄️ Database Setup

### **Migrations**

This project uses `migrate-mongo` for database migrations.

#### **Available Migration Commands:**

```bash
# Run all pending migrations
npm run migrate:up

# Rollback the last migration
npm run migrate:down

# Check migration status
npm run migrate:status

# Create a new migration
npm run migrate:create add_new_feature

# Reset database (drop all collections and re-run migrations)
npm run db:reset
```

#### **Migration Files:**
- `001_create_initial_collections.js` - Creates initial collections and indexes
- `002_add_soft_delete.js` - Adds soft delete functionality

### **Seeders**

The project includes a comprehensive seeder system for development and testing.

#### **Available Seeder Commands:**

```bash
# Seed database with sample data
npm run seed

# Clear all data from database
npm run seed:clear

# Reset database and seed with fresh data
npm run db:reset
```

#### **Sample Data Created:**
- **3 Organizations** (Schools/Institutions)
- **Multiple Users** (Admins, Teachers, Students)
- **Classes** with student enrollments
- **Questions** (MCQ, True/False, Short Answer)
- **Exams** with question items
- **Sample Assignments**

## 🎯 Usage

### **Start the Application:**
```bash
npm start
```
The application will be available at `http://localhost:3000`.

### **Development Workflow:**

1. **First Time Setup:**
   ```bash
   # Install dependencies
   npm install
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your database URL
   
   # Run migrations
   npm run migrate:up
   
   # Seed with sample data
   npm run seed
   
   # Start the application
   npm start
   ```

2. **Database Changes:**
   ```bash
   # Create new migration
   npm run migrate:create add_new_feature
   
   # Edit the migration file in src/migrations/
   
   # Run migration
   npm run migrate:up
   ```

3. **Reset Development Database:**
   ```bash
   # Clear and reseed database
   npm run db:reset
   ```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📊 Database Schema

### **Core Collections:**
- **Organizations** - Multi-tenant organizations (schools, institutions)
- **Users** - Admins, Teachers, Students with role-based access
- **Classes** - Class management with student enrollments
- **Questions** - Question bank with multiple types (MCQ, TF, Short)
- **Exams** - Exam creation with question items
- **Assignments** - Exam assignments to classes
- **Submissions** - Student exam submissions
- **ProctorLogs** - Exam monitoring and security logs

### **Key Features:**
- **Multi-tenant Architecture** - Isolated data per organization
- **Role-based Access Control** - Admin, Teacher, Student roles
- **Soft Delete** - Safe data deletion with recovery
- **Audit Trail** - Complete activity logging
- **Scalable Design** - Optimized for growth

## 🔧 Development

### **Available Scripts:**
```bash
npm start          # Start development server
npm test           # Run tests
npm run migrate:up # Run database migrations
npm run migrate:down # Rollback migrations
npm run migrate:status # Check migration status
npm run seed       # Seed database
npm run seed:clear # Clear database
npm run db:reset   # Reset and reseed database
```

### **Environment Variables:**
- `DATABASE_MG_URL` - MongoDB connection string
- `MIGRATE_MG_URL` - Migration database URL
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run migrations if needed: `npm run migrate:up`
6. Commit your changes: `git commit -m 'Add new feature'`
7. Push to the branch: `git push origin feature/new-feature`
8. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Troubleshooting

### **Common Issues:**

1. **Migration fails:**
   ```bash
   # Check database connection
   node -e "require('dotenv').config(); console.log('DATABASE_MG_URL:', process.env.DATABASE_MG_URL)"
   
   # Verify config
   node -e "const config = require('./migrate-mongo-config.js'); console.log('Config:', config)"
   ```

2. **Seeder fails:**
   ```bash
   # Clear database first
   npm run seed:clear
   
   # Then reseed
   npm run seed
   ```

3. **Database connection issues:**
   - Verify MongoDB URL in `.env`
   - Check network connectivity
   - Ensure MongoDB Atlas IP whitelist includes your IP

### **Getting Help:**
- Check the logs for detailed error messages
- Verify environment variables are set correctly
- Ensure MongoDB is accessible and credentials are correct
```

Tôi đã cập nhật README.md với:

## ✅ **Những gì đã thêm:**

1. **Database Setup section** - Hướng dẫn migration và seeder
2. **Migration Commands** - Tất cả commands cần thiết
3. **Seeder Commands** - Hướng dẫn seed dữ liệu
4. **Development Workflow** - Quy trình phát triển
5. **Database Schema** - Mô tả cấu trúc database
6. **Troubleshooting** - Xử lý lỗi thường gặp
7. **Environment Variables** - Danh sách biến môi trường

## 🎯 **Các commands chính:**

```bash
# Setup lần đầu
npm install
cp .env.example .env
npm run migrate:up
npm run seed
npm start

# Development hàng ngày
npm run migrate:up    # Chạy migration mới
npm run seed:clear    # Xóa dữ liệu test
npm run seed          # Seed dữ liệu mới
npm run db:reset      # Reset toàn bộ
```

README.md giờ đã đầy đủ hướng dẫn cho team development!