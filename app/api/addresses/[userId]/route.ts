import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { authorizeUser } from '@/lib/authOptions';
import prisma from '@/lib/prisma';

type Address = {
  fullName: string;
  phoneNumber: string;
  pincode?: string;
  area: string;
  street?: string;
  city: string;
  state: string;
  country?: string;
  isDefault: boolean;
};

interface AuthResult {
  success: boolean;
  message?: string;
  userId?: string;
}

// ✅ CORRECT usage of RouteContext with { params }
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ success: false, message: 'User ID invalide.' }, { status: 400 });
  }

  const authResult: AuthResult = await authorizeUser(req, userId);
  if (!authResult.success) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { isDefault: 'desc' },
  });

  return NextResponse.json({ success: true, addresses }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const addressData: Partial<Address> = await req.json();

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ success: false, message: 'User ID invalide.' }, { status: 400 });
  }

  const authResult: AuthResult = await authorizeUser(req, userId);
  if (!authResult.success) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const requiredFields: (keyof Address)[] = ['fullName', 'phoneNumber', 'area', 'city', 'state'];
  const hasAllFields = requiredFields.every((field) => !!addressData[field]);

  if (!hasAllFields) {
    return NextResponse.json({ success: false, message: 'Champs obligatoires manquants.' }, { status: 400 });
  }

  if (addressData.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const newAddress = await prisma.address.create({
    data: {
      ...addressData,
      userId,
      isDefault: addressData.isDefault ?? false,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Adresse ajoutée avec succès.',
    address: newAddress,
  }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const addressData: Partial<Address> & { id?: string } = await req.json();

  if (!userId || typeof userId !== 'string' || !addressData.id) {
    return NextResponse.json({ success: false, message: 'Identifiants invalides.' }, { status: 400 });
  }

  const authResult: AuthResult = await authorizeUser(req, userId);
  if (!authResult.success) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const requiredFields: (keyof Address)[] = ['fullName', 'phoneNumber', 'area', 'city', 'state'];
  const hasAllFields = requiredFields.every((field) => !!addressData[field]);

  if (!hasAllFields) {
    return NextResponse.json({ success: false, message: 'Champs obligatoires manquants.' }, { status: 400 });
  }

  const addressId = parseInt(addressData.id);
  if (isNaN(addressId)) {
    return NextResponse.json({ success: false, message: 'ID d’adresse invalide.' }, { status: 400 });
  }

  if (addressData.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  try {
    const updatedAddress = await prisma.address.update({
      where: { id: addressId, userId },
      data: { ...addressData },
    });

    return NextResponse.json({
      success: true,
      message: 'Adresse mise à jour.',
      address: updatedAddress,
    }, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ success: false, message: 'Adresse introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ success: false, message: 'Erreur lors de la mise à jour.' }, { status: 500 });
  }
}
