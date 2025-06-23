import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from '@/lib/auth';

const uri = process.env.MONGODB_URI || '';
const projectsCollection = 'projects';

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const { projectId } = params;
  // Authenticate user
  const authHeader = request.headers.get('authorization');
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : request.cookies.get('token')?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  const payload = await verifyAuth(token);
  if (!payload) {
    return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
  }
  const userEmail = payload.email || '';
  const userRole = payload.role || '';
  const companyCode = request.headers.get('X-Company-Code') || payload.companyCode || '';
  if (!companyCode) {
    return NextResponse.json({ success: false, message: 'Company code required' }, { status: 400 });
  }

  // Parse body
  const body = await request.json();
  const { linkedProjectId } = body;
  if (!linkedProjectId) {
    return NextResponse.json({ success: false, message: 'linkedProjectId is required' }, { status: 400 });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(`company_${companyCode.toLowerCase()}`);
  const col = db.collection(projectsCollection);

  // Fetch main project for permission check
  const project = await col.findOne({ _id: new ObjectId(projectId) });
  if (!project) {
    await client.close();
    return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
  }
  const isTopManagement = ['top_management_tier_1','top_management_tier_2','top_management_tier_3'].includes(userRole);
  const isMember = Array.isArray(project.employees) && project.employees.some((e: any) => e.email === userEmail || e.employee_email === userEmail);
  if (!isTopManagement && !isMember) {
    await client.close();
    return NextResponse.json({ success: false, message: 'Access Denied - cannot link projects' }, { status: 403 });
  }

  // Perform link: add to set
  await col.updateOne(
    { _id: new ObjectId(projectId) },
    { $addToSet: { linkedProjects: new ObjectId(linkedProjectId) } }
  );

  // Return updated project
  const updated = await col.findOne({ _id: new ObjectId(projectId) });
  await client.close();
  return NextResponse.json({ success: true, project: updated });
}

// Handler to remove a linked project
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string } }) {
  const { projectId } = params;
  // Authenticate user
  const authHeader = request.headers.get('authorization');
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : request.cookies.get('token')?.value;
  if (!token) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  const payload = await verifyAuth(token);
  if (!payload) return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
  const userEmail = payload.email || '';
  const userRole = payload.role || '';
  const companyCode = request.headers.get('X-Company-Code') || payload.companyCode || '';
  if (!companyCode) return NextResponse.json({ success: false, message: 'Company code required' }, { status: 400 });

  // Parse body for linkedProjectId
  const body = await request.json();
  const { linkedProjectId } = body;
  if (!linkedProjectId) return NextResponse.json({ success: false, message: 'linkedProjectId is required' }, { status: 400 });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(`company_${companyCode.toLowerCase()}`);
  const col = db.collection(projectsCollection);

  // Permission check as in POST
  const project = await col.findOne({ _id: new ObjectId(projectId) });
  if (!project) { await client.close(); return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 }); }
  const isTopManagement = ['top_management_tier_1','top_management_tier_2','top_management_tier_3'].includes(userRole);
  const isMember = Array.isArray(project.employees) && project.employees.some((e: any) => e.email === userEmail || e.employee_email === userEmail);
  if (!isTopManagement && !isMember) { await client.close(); return NextResponse.json({ success: false, message: 'Access Denied - cannot unlink projects' }, { status: 403 }); }

  // Unlink
  await col.updateOne(
    { _id: new ObjectId(projectId) },
    { $pull: { linkedProjects: new ObjectId(linkedProjectId) } } as any
  );

  const updated = await col.findOne({ _id: new ObjectId(projectId) });
  await client.close();
  return NextResponse.json({ success: true, project: updated });
}
