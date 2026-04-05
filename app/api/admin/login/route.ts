import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

// 简单的token生成（生产环境应使用JWT）
function generateToken(): string {
  return Buffer.from(Date.now().toString() + Math.random()).toString('base64');
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username }
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 更新最后登录时间
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    // 生成token
    const token = generateToken();

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '登录失败，请重试' },
      { status: 500 }
    );
  }
}

// 初始化默认管理员账户
export async function GET() {
  try {
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: 'admin' }
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.admin.create({
        data: {
          username: 'admin',
          passwordHash,
          email: 'admin@example.com',
          role: 'superadmin'
        }
      });
      return NextResponse.json({ message: 'Default admin created' });
    }

    return NextResponse.json({ message: 'Admin already exists' });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 });
  }
}
