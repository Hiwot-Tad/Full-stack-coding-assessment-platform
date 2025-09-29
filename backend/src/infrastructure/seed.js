import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const name = 'Admin';
  const role = 'admin';
  const password = 'admin123';
  const password_hash = await bcrypt.hash(password, 10);

  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin already exists:', email);
  } else {
    const user = await prisma.users.create({
      data: { name, email, password_hash, role }
    });
    console.log('Seeded admin user:', { email: user.email, password });
  }

  // Seed a sample recruiter user
  const recruiterEmail = 'recruiter@example.com';
  const existingRecruiter = await prisma.users.findUnique({ where: { email: recruiterEmail } });
  if (!existingRecruiter) {
    const recruiterUser = await prisma.users.create({
      data: { name: 'Recruiter', email: recruiterEmail, password_hash: await bcrypt.hash('recruiter123', 10), role: 'recruiter' }
    });
    console.log('Seeded recruiter user:', { email: recruiterUser.email, password: 'recruiter123' });
  } else {
    console.log('Recruiter user already exists.');
  }

  // Seed a sample candidate user
  const candidateEmail = 'candidate@example.com';
  const existingCandidate = await prisma.users.findUnique({ where: { email: candidateEmail } });
  if (!existingCandidate) {
    const candidateUser = await prisma.users.create({
      data: { name: 'Candidate', email: candidateEmail, password_hash: await bcrypt.hash('candidate123', 10), role: 'candidate' }
    });
    console.log('Seeded candidate user:', { email: candidateUser.email, password: 'candidate123' });
  } else {
    console.log('Candidate user already exists.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
