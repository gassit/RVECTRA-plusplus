import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const DOWNLOAD_DIR = '/home/z/my-project/download';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const { file } = await params;
  const fileName = file.join('/');

  const allowedFiles = ['import.service.ts', 'network-digital-twin.tar.gz'];
  if (!allowedFiles.includes(fileName)) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
  }

  const filePath = path.join(DOWNLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const contentType = fileName.endsWith('.gz')
    ? 'application/gzip'
    : 'text/plain';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}
