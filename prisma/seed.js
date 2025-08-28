// prisma/seed.js
/* eslint-disable no-console */
const { PrismaClient, TagCode } = require('@prisma/client');

const prisma = new PrismaClient();

// Match lib/tags.ts — keep a single source of truth in prod.
const TAG_META = {
  FAMILY: { label: 'Family', color: '#f97316' },
  CLOSE_FRIEND: { label: 'Close friend', color: '#22c55e' },
  FRIEND: { label: 'Friend', color: '#3b82f6' },
  LOVE_INTEREST: { label: 'Love interest', color: '#e11d48' },
  RELATIONSHIP: { label: 'Relationship', color: '#a855f7' },
  ACQUAINTANCE: { label: 'Acquaintance', color: '#14b8a6' },
  ENCOUNTER: { label: 'Encounter', color: '#64748b' },
};

async function main() {
  console.log('Seeding tags…');
  for (const code of Object.keys(TagCode)) {
    await prisma.tag.upsert({
      where: { code },
      update: {},
      create: { code, label: TAG_META[code].label, color: TAG_META[code].color },
    });
  }

  console.log('Seeding people…');
  const alice = await prisma.person.create({
    data: {
      name: 'Alice Example',
      is_online: false,
      location_name: 'Berlin, Germany',
      lat: 52.52,
      lng: 13.405,
      met_at: new Date('2024-08-01T10:30:00Z'),
      notes: 'Met at a meetup',
    },
  });

  const bob = await prisma.person.create({
    data: {
      name: 'Bob Online',
      is_online: true,
      met_at: new Date('2024-09-15T18:00:00Z'),
      platform: 'Zoom',
      context_url: 'https://example.com/meet',
    },
  });

  const friendTag = await prisma.tag.findUnique({ where: { code: 'FRIEND' } });
  const acquaintTag = await prisma.tag.findUnique({ where: { code: 'ACQUAINTANCE' } });

  await prisma.personTag.createMany({
    data: [
      { personId: alice.id, tagId: friendTag.id },
      { personId: bob.id, tagId: acquaintTag.id },
    ],
    skipDuplicates: true,
  });

  console.log('Seeding diary entries…');
  const entry1 = await prisma.diaryEntry.create({
    data: {
      content: 'Coffee with Alice at Rosenthaler Platz',
      start_at: new Date('2024-08-01T10:30:00Z'),
      location_name: 'Rosenthaler Platz, Berlin',
      lat: 52.529,
      lng: 13.401,
    },
  });
  await prisma.diaryEntryPerson.create({ data: { diaryEntryId: entry1.id, personId: alice.id } });

  const entry2 = await prisma.diaryEntry.create({
    data: {
      content: 'Long Zoom chat with Bob',
      start_at: new Date('2024-09-15T18:00:00Z'),
    },
  });
  await prisma.diaryEntryPerson.create({ data: { diaryEntryId: entry2.id, personId: bob.id } });

  console.log('Seed complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

