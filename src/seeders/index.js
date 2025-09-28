const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Class = require('../models/Class');
const Question = require('../models/Question');
const Exam = require('../models/Exam');

class Seeder {
  async connect() {
    try {
      await mongoose.connect(process.env.DB_URI || 'mongodb://localhost:27017/edumap');
      console.log('Connected to MongoDB for seeding');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  async clearDatabase() {
    console.log('Clearing database...');
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Class.deleteMany({});
    await Question.deleteMany({});
    await Exam.deleteMany({});
    console.log('Database cleared');
  }

  async seed() {
    try {
      await this.connect();
      await this.clearDatabase();
      
      // Seed organizations
      const organizations = await this.seedOrganizations();
      
      // Seed users
      const users = await this.seedUsers(organizations);
      
      // Seed classes
      const classes = await this.seedClasses(organizations, users);
      
      // Seed questions
      const questions = await this.seedQuestions(organizations, users);
      
      // Seed exams
      const exams = await this.seedExams(organizations, users, questions);
      
      console.log('✅ Seeding completed successfully!');
      console.log(`📊 Created: ${organizations.length} organizations, ${users.length} users, ${classes.length} classes, ${questions.length} questions, ${exams.length} exams`);
      
    } catch (error) {
      console.error('❌ Seeding failed:', error);
    } finally {
      await this.disconnect();
    }
  }

  async seedOrganizations() {
    console.log('Seeding organizations...');
    
    const organizations = [
      {
        name: 'Trường THPT Nguyễn Du',
        domain: 'nguyendu.edu.vn',
        plan: 'pro',
        status: 'active'
      },
      {
        name: 'Trường THPT Lê Hồng Phong',
        domain: 'lehongphong.edu.vn',
        plan: 'free',
        status: 'active'
      },
      {
        name: 'Trung tâm Anh ngữ ABC',
        domain: 'abc.edu.vn',
        plan: 'enterprise',
        status: 'active'
      }
    ];

    const createdOrgs = [];
    for (const orgData of organizations) {
      const org = new Organization(orgData);
      await org.save();
      createdOrgs.push(org);
    }

    return createdOrgs;
  }

  async seedUsers(organizations) {
    console.log('Seeding users...');
    
    const users = [];
    
    // Tạo admin cho mỗi organization
    for (const org of organizations) {
      const adminUser = new User({
        orgId: org._id,
        name: `Admin ${org.name}`,
        email: `admin@${org.domain}`,
        passwordHash: await bcrypt.hash('admin123', 12),
        role: 'admin',
        status: 'active',
        isOrgOwner: true
      });
      await adminUser.save();
      users.push(adminUser);
      
      // Cập nhật organization với ownerId
      org.ownerId = adminUser._id;
      await org.save();
    }

    // Tạo teachers
    const teacherData = [
      { name: 'Nguyễn Văn A', email: 'teacher1@nguyendu.edu.vn', orgId: organizations[0]._id },
      { name: 'Trần Thị B', email: 'teacher2@nguyendu.edu.vn', orgId: organizations[0]._id },
      { name: 'Lê Văn C', email: 'teacher1@lehongphong.edu.vn', orgId: organizations[1]._id },
      { name: 'Phạm Thị D', email: 'teacher1@abc.edu.vn', orgId: organizations[2]._id }
    ];

    for (const teacher of teacherData) {
      const user = new User({
        ...teacher,
        passwordHash: await bcrypt.hash('teacher123', 12),
        role: 'teacher',
        status: 'active'
      });
      await user.save();
      users.push(user);
    }

    // Tạo students
    const studentData = [
      { name: 'Học sinh 1', email: 'student1@nguyendu.edu.vn', orgId: organizations[0]._id },
      { name: 'Học sinh 2', email: 'student2@nguyendu.edu.vn', orgId: organizations[0]._id },
      { name: 'Học sinh 3', email: 'student3@nguyendu.edu.vn', orgId: organizations[0]._id },
      { name: 'Học sinh 4', email: 'student1@lehongphong.edu.vn', orgId: organizations[1]._id },
      { name: 'Học sinh 5', email: 'student1@abc.edu.vn', orgId: organizations[2]._id }
    ];

    for (const student of studentData) {
      const user = new User({
        ...student,
        passwordHash: await bcrypt.hash('student123', 12),
        role: 'student',
        status: 'active'
      });
      await user.save();
      users.push(user);
    }

    return users;
  }

  async seedClasses(organizations, users) {
    console.log('Seeding classes...');
    
    const classes = [];
    const teachers = users.filter(u => u.role === 'teacher');
    const students = users.filter(u => u.role === 'student');

    for (let i = 0; i < organizations.length; i++) {
      const org = organizations[i];
      const orgTeachers = teachers.filter(t => t.orgId.toString() === org._id.toString());
      const orgStudents = students.filter(s => s.orgId.toString() === org._id.toString());

      if (orgTeachers.length > 0) {
        const classData = {
          orgId: org._id,
          name: `Lớp ${i + 1}A`,
          code: `CLASS${i + 1}A`,
          teacherId: orgTeachers[0]._id,
          studentIds: orgStudents.slice(0, 2).map(s => s._id),
          settings: {
            allowLateSubmission: true,
            maxAttempts: 3,
            proctoringEnabled: false
          },
          metadata: {
            subject: 'Toán học',
            semester: 'Học kỳ 1',
            academicYear: '2024-2025'
          }
        };

        const classObj = new Class(classData);
        await classObj.save();
        classes.push(classObj);
      }
    }

    return classes;
  }

  async seedQuestions(organizations, users) {
    console.log('Seeding questions...');
    
    const questions = [];
    const teachers = users.filter(u => u.role === 'teacher');

    for (const teacher of teachers) {
      const questionData = [
        {
          orgId: teacher.orgId,
          ownerId: teacher._id,
          type: 'mcq',
          text: 'Phương trình bậc hai ax² + bx + c = 0 có nghiệm khi nào?',
          choices: [
            { key: 'A', text: 'Δ > 0' },
            { key: 'B', text: 'Δ ≥ 0' },
            { key: 'C', text: 'Δ < 0' },
            { key: 'D', text: 'Δ = 0' }
          ],
          answer: { keys: ['B'] },
          tags: ['toan', 'phuong-trinh'],
          level: 2,
          metadata: {
            chapter: 'Chương 1',
            source: 'SGK Toán 10',
            estimatedTime: 60
          }
        },
        {
          orgId: teacher.orgId,
          ownerId: teacher._id,
          type: 'tf',
          text: 'Hàm số y = x² là hàm số chẵn.',
          answer: { value: true },
          tags: ['toan', 'ham-so'],
          level: 1,
          metadata: {
            chapter: 'Chương 2',
            source: 'SGK Toán 10',
            estimatedTime: 30
          }
        },
        {
          orgId: teacher.orgId,
          ownerId: teacher._id,
          type: 'short',
          text: 'Tính đạo hàm của hàm số y = x³ + 2x² - 5x + 1',
          answer: { text: 'y\' = 3x² + 4x - 5' },
          tags: ['toan', 'dao-ham'],
          level: 3,
          metadata: {
            chapter: 'Chương 3',
            source: 'SGK Toán 11',
            estimatedTime: 120
          }
        }
      ];

      for (const qData of questionData) {
        const question = new Question(qData);
        await question.save();
        questions.push(question);
      }
    }

    return questions;
  }

  async seedExams(organizations, users, questions) {
    console.log('Seeding exams...');
    
    const exams = [];
    const teachers = users.filter(u => u.role === 'teacher');

    for (const teacher of teachers) {
      const orgQuestions = questions.filter(q => q.orgId.toString() === teacher.orgId.toString());
      
      if (orgQuestions.length > 0) {
        const examData = {
          orgId: teacher.orgId,
          ownerId: teacher._id,
          title: 'Kiểm tra 15 phút - Đại số',
          description: 'Bài kiểm tra về phương trình và hàm số',
          settings: {
            openAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 ngày sau
            closeAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày sau
            duration: 15, // 15 phút
            attempts: 1,
            shuffle: true,
            showResult: true,
            allowReview: true,
            proctoring: {
              enabled: false,
              strictMode: false
            }
          },
          items: orgQuestions.slice(0, 3).map((q, index) => ({
            questionId: q._id,
            points: 1,
            order: index + 1
          })),
          status: 'published'
        };

        const exam = new Exam(examData);
        await exam.save();
        exams.push(exam);
      }
    }

    return exams;
  }
}

module.exports = Seeder;
