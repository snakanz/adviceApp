const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create test user (Google-linked)
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@gmail.com' },
    update: {},
    create: {
      email: 'testuser@gmail.com',
      name: 'Test User',
      provider: 'google',
      providerId: 'mock-google-id',
    },
  });

  // Meeting times
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  // Insert meetings one by one
  const meetings = [
    {
      userId: testUser.id,
      googleEventId: 'event-1',
      title: 'Initial Meeting with Client A',
      startTime: daysAgo(14),
      endTime: daysAgo(14),
      status: 'completed',
    },
    {
      userId: testUser.id,
      googleEventId: 'event-2',
      title: 'Initial Meeting with Client B',
      startTime: daysAgo(10),
      endTime: daysAgo(10),
      status: 'completed',
    },
    {
      userId: testUser.id,
      googleEventId: 'event-3',
      title: 'Cashflow Meeting',
      startTime: daysAgo(7),
      endTime: daysAgo(7),
      status: 'completed',
    },
    {
      userId: testUser.id,
      googleEventId: 'event-4',
      title: 'Review Meeting',
      startTime: daysAgo(3),
      endTime: daysAgo(3),
      status: 'completed',
    },
    {
      userId: testUser.id,
      googleEventId: 'event-5',
      title: 'Upcoming Review Meeting',
      startTime: daysFromNow(5),
      endTime: daysFromNow(5),
      status: 'scheduled',
    },
  ];

  for (const meeting of meetings) {
    await prisma.meeting.create({ data: meeting });
  }

  console.log('Seed data inserted successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 