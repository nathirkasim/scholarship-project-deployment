import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, 'GET')
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, 'POST')
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, 'PUT')
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, 'PATCH')
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, 'DELETE')
}

async function proxy(req: NextRequest, pathParts: string[], method: string) {
  const path = pathParts.join('/')
  const url  = `${API_URL}/api/${path}${req.nextUrl.search}`

  const contentType = req.headers.get('content-type') || ''
  const headers: Record<string, string> = {}

  // Forward Content-Type only for non-multipart (let fetch set boundary for multipart)
  if (contentType && !contentType.includes('multipart/form-data')) {
    headers['Content-Type'] = contentType
  }

  const cookie = req.headers.get('cookie')
  if (cookie) headers['Cookie'] = cookie

  const init: RequestInit = { method, headers }

  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType.includes('multipart/form-data')) {
      // Stream the raw body for file uploads; browser set the correct boundary
      init.body = await req.arrayBuffer()
      // Restore the full content-type with boundary for the upstream request
      headers['Content-Type'] = contentType
    } else {
      try { init.body = await req.text() } catch { /* empty body */ }
    }
  }

  try {
    const res = await fetch(url, init)

    // Preserve upstream content-type
    const upstreamCT = res.headers.get('content-type') || 'application/json'
    const isBinary = upstreamCT.includes('application/pdf') || upstreamCT.includes('octet-stream') || upstreamCT.includes('text/csv')

    let body: ArrayBuffer | string
    if (isBinary) {
      body = await res.arrayBuffer()
    } else {
      body = await res.text()
    }

    const response = new NextResponse(body, { status: res.status })
    response.headers.set('Content-Type', upstreamCT)

    // Forward Content-Disposition for file downloads
    const disposition = res.headers.get('content-disposition')
    if (disposition) response.headers.set('Content-Disposition', disposition)

    // Forward cookies from API
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) response.headers.set('Set-Cookie', setCookie)

    return response
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 })
  }
}
