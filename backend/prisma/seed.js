const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create sample users
  const user1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      name: 'John Doe',
      provider: 'google',
      providerId: 'google_123',
      meetings: {
        create: [
          {
            title: 'Initial Financial Review',
            type: 'Intro Meeting',
            date: new Date('2025-07-01'),
            time: '10:00',
          },
          {
            title: 'Monthly Cash Flow Analysis',
            type: 'Cashflow Meeting',
            date: new Date('2025-07-15'),
            time: '14:30',
          }
        ]
      }
    }
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      provider: 'microsoft',
      providerId: 'ms_456',
      meetings: {
        create: [
          {
            title: 'Portfolio Performance Review',
            type: 'Performance Meeting',
            date: new Date('2025-07-05'),
            time: '11:00',
          },
          {
            title: 'Investment Strategy Session',
            type: 'Review Meeting',
            date: new Date('2025-07-20'),
            time: '15:00',
          }
        ]
      }
    }
  });

  console.log('Sample data created:', { user1, user2 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 