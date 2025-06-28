require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;
const tasks = JSON.parse(fs.readFileSync('tasks.json', 'utf8'));

async function addOrUpdateTask(task) {
  // Search for existing page with the same id
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'id',
      number: { equals: task.id }
    }
  });

  if (response.results.length > 0) {
    // Update existing page
    const pageId = response.results[0].id;
    await notion.pages.update({
      page_id: pageId,
      properties: {
        title: { title: [{ text: { content: task.title } }] },
        description: { rich_text: [{ text: { content: task.description } }] },
        status: { select: { name: task.status } },
        assignee: { rich_text: [{ text: { content: task.assignee } }] },
        created: { date: { start: task.created } },
        updated: { date: { start: task.updated } },
        id: { number: task.id }
      }
    });
    console.log(`Updated task: ${task.title}`);
  } else {
    // Create new page
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: { title: [{ text: { content: task.title } }] },
        description: { rich_text: [{ text: { content: task.description } }] },
        status: { select: { name: task.status } },
        assignee: { rich_text: [{ text: { content: task.assignee } }] },
        created: { date: { start: task.created } },
        updated: { date: { start: task.updated } },
        id: { number: task.id }
      }
    });
    console.log(`Created task: ${task.title}`);
  }
}

(async () => {
  for (const task of tasks) {
    await addOrUpdateTask(task);
  }
  console.log('Sync complete!');
})(); 