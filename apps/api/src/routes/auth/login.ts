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
    return { token };
  });
}