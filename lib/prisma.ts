// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Déclarez une variable globale pour PrismaClient afin de le rendre disponible
// dans l'environnement global et éviter de multiples instantiations en development.
// Ceci est spécifique à TypeScript pour entendre l'objet global.
declare global {
  var prisma: PrismaClient | undefined;
}

// Initialise PrismaClient.
// En production, une nouvelle instance est toujours créée.
// En développement, on réutilise l'instance globale si elle existe.
const prisma = global.prisma || new PrismaClient();

// En development, attache l'instance à l'objet global pour la reutilization.
if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;
