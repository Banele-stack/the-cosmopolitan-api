import * as nodemailer from "nodemailer";

export async function sendVerificationEmail(
  email: string,
  code: string,
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Findza" <${process.env.EMAIL_USERNAME}>`,
    to: email,
    subject: "Findza Verification Code",
    html: `
      <h2>Verify your account</h2>

      <p>Your verification code is:</p>

      <h1>${code}</h1>

      <p>This code expires in 10 minutes.</p>
    `,
  });
}