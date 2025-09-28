const request = require('supertest');
const app = require('../src/app');

describe('GET /', () => {
    it('should respond with status 200 and render the index view', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toContain('Welcome'); // Adjust based on actual content in index.ejs
    });
});

// Additional tests can be added here for other routes and functionalities.