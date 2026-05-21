import { FastifyInstance } from 'fastify';
import { prisma } from '@voltera/db';
import bcrypt from 'bcryptjs';

export default async function (fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;
    
    const tenant = await prisma.tenant.findUnique({ where: { email } });
    if (!tenant) return reply.status(401).send({ error: 'Date incorecte' });

    const isValid = await bcrypt.compare(password, tenant.passwordHash);
    if (!isValid) return reply.status(401).send({ error: 'Date incorecte' });

    const token = fastify.jwt.sign({ tenantId: tenant.id, email: tenant.email });

    // Setăm cookie-ul HttpOnly
    reply.setCookie('voicero_token', token, {
      path: '/',
      httpOnly: true, // Previne accesul via JavaScript (Protecție XSS)
      secure: process.env.NODE_ENV === 'production', // Doar pe HTTPS în producție
      sameSite: 'lax', // Protecție CSRF
      maxAge: 60 * 60 * 24 * 7 // Expiră în 7 zile
    });

    return { 
      status: 'success', 
      user: { id: tenant.id, email: tenant.email, name: tenant.name } 
    };
  });
}