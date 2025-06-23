import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const dbName = 'org_sim_db';

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const tasksCollection = db.collection('Tasks');
    const tasks = await tasksCollection.find({ project_id: projectId }).toArray();
    const formatted = tasks.map((t: any) => ({
      id: t._id?.toString() || t.id,
      task_title: t.task_title,
      task_description: t.task_description,
      task_status: t.task_status,
      assigned_user_id: t.assigned_user_id,
      project_id: t.project_id,
    }));
    return NextResponse.json({ tasks: formatted });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  } finally {
    await client.close();
  }
}
