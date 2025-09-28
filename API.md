# AUTH
## api/register
### call: https://edu-map-be.vercel.app/api/register
#### method: POST
-- body --
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@example.com",
  "password": "yourpassword",
  "role": "student", // or teacher
}


## api/login
### call: https://edu-map-be.vercel.app/api/login
#### method: POST
-- body --
{
  "email": "nguyenvana@example.com",
  "password": "yourpassword",
}
