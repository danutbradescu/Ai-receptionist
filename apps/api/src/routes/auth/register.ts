import { FastifyInstance } from 'fastify';
import { prisma } from '@voltera/db';
import bcrypt from 'bcryptjs';

export default async function (fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const { email, password, name } = request.body as any;
    
    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) {
      return reply.status(400).send({ error: 'Email deja folosit' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    try {
      const tenant = await prisma.tenant.create({
        data: { email, passwordHash, name }
      });

      return { status: 'success', tenantId: tenant.id };
    } catch (error) {
      return reply.status(500).send({ error: 'Eroare la crearea contului' });
    }
  });
}