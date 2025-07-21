// app/api/dashboard/stats/route.ts
// Cette route gère la récupération des statistiques pour le tableau de bord administrateur.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeAdminRequest, AuthResult } from '@/lib/authUtils';
import { Prisma } from '@prisma/client'; // Importez le namespace Prisma pour des types plus précis
import { Decimal } from '@prisma/client/runtime/library'; // Importez le type Decimal

export async function GET(req: NextRequest): Promise<NextResponse> {
    // 1. Autorisation (seuls les admins peuvent accéder aux stats du tableau de bord)
    const authResult: AuthResult = await authorizeAdminRequest(req);
    if (!authResult.authorized) return authResult.response!;

    try {
        // Définition du type pour les commandes récentes en utilisant Prisma.OrderGetPayload
        type RecentOrderPayload = Prisma.OrderGetPayload<{
            select: {
                id: true;
                totalAmount: true;
                status: true;
                paymentStatus: true;
                shippingAddressLine1: true;
                shippingAddressLine2: true;
                shippingCity: true;
                shippingState: true;
                shippingZipCode: true;
                shippingCountry: true;
                orderDate: true;
                user: {
                    select: {
                        firstName: true;
                        lastName: true;
                        email: true;
                    };
                };
                payment: {
                    select: {
                        paymentMethod: true;
                        status: true;
                        transactionId: true;
                        paymentDate: true;
                    };
                };
            };
        }>;

        // Définition des types pour les résultats de groupBy
        // Ces types décrivent la forme des objets DANS le tableau retourné par groupBy
        type OrdersPerMonthGroupByItem = {
            orderDate: Date;
            _count: { id: number };
        };

        type RevenuePerMonthGroupByItem = {
            orderDate: Date;
            _sum: { totalAmount: Decimal | null };
        };


        const [
            totalProducts,
            totalOrders,
            pendingOrders,
            totalRevenueResult,
            totalUsers, // <-- Correctement positionné ici
            recentOrders,
            ordersPerMonthResult,
            revenuePerMonthResult,
        ] = await Promise.all([
            prisma.product.count(),
            prisma.order.count(),
            prisma.order.count({
                where: { status: 'PENDING' },
            }),
            prisma.order.aggregate({
                _sum: {
                    totalAmount: true,
                },
                where: { status: 'PAID_SUCCESS' },
            }),
            prisma.user.count(), // <-- AJOUTÉ ICI pour correspondre à totalUsers

            // Récupération des commandes récentes
            prisma.order.findMany({
                orderBy: { orderDate: 'desc' },
                take: 15,
                select: {
                    id: true,
                    totalAmount: true,
                    status: true,
                    paymentStatus: true,
                    shippingAddressLine1: true,
                    shippingAddressLine2: true,
                    shippingCity: true,
                    shippingState: true,
                    shippingZipCode: true,
                    shippingCountry: true,
                    orderDate: true,
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    payment: {
                        select: {
                            paymentMethod: true,
                            status: true,
                            transactionId: true,
                            paymentDate: true,
                        },
                    },
                },
            }), // Removed explicit 'as Promise<RecentOrderPayload[]>' here, let destructuring handle it

            // Agrégation des commandes par mois
            prisma.order.groupBy({
                by: ['orderDate'], // Groupement par date complète, nous extrairons le mois plus tard
                _count: {
                    id: true,
                },
                where: {
                    orderDate: {
                        gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
                    },
                },
                orderBy: {
                    orderDate: 'asc',
                },
            }), // Removed explicit 'as Promise<OrdersPerMonthResult[]>' here

            // Agrégation des revenus par mois
            prisma.order.groupBy({
                by: ['orderDate'], // Groupement par date complète
                _sum: {
                    totalAmount: true,
                },
                where: {
                    status: 'PAID_SUCCESS',
                    orderDate: {
                        gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
                    },
                },
                orderBy: {
                    orderDate: 'asc',
                },
            }), // Removed explicit 'as Promise<RevenuePerMonthResult[]>' here
        ]);

        const monthlyOrdersMap = new Map<string, number>();
        // Cast the result of groupBy to the correct item type for iteration
        (ordersPerMonthResult as OrdersPerMonthGroupByItem[]).forEach((item) => {
            const monthKey = new Date(item.orderDate).toISOString().substring(0, 7);
            monthlyOrdersMap.set(monthKey, (monthlyOrdersMap.get(monthKey) || 0) + item._count.id);
        });

        const monthlyRevenueMap = new Map<string, number>();
        // Cast the result of groupBy to the correct item type for iteration
        (revenuePerMonthResult as RevenuePerMonthGroupByItem[]).forEach((item) => {
            const monthKey = new Date(item.orderDate).toISOString().substring(0, 7);
            // Convertir Decimal en number avec .toNumber()
            monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + (item._sum.totalAmount?.toNumber() || 0));
        });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1); // Définir au premier jour du mois pour une meilleure cohérence

        const ordersPerMonth: { month: string; orderCount: number }[] = [];
        const revenuePerMonth: { month: string; totalMonthlyRevenue: number }[] = [];

        for (let i = 0; i < 6; i++) {
            const currentMonth = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
            const monthKey = currentMonth.toISOString().substring(0, 7);

            ordersPerMonth.push({
                month: monthKey,
                orderCount: monthlyOrdersMap.get(monthKey) || 0,
            });
            revenuePerMonth.push({
                month: monthKey,
                totalMonthlyRevenue: monthlyRevenueMap.get(monthKey) || 0,
            });
        }

        // Mapper les commandes récentes pour le format de sortie souhaité
        const formattedRecentOrders = (recentOrders as RecentOrderPayload[]).map(order => ({
            orderId: order.id, // ID est maintenant string
            customerName: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim(),
            customerEmail: order.user?.email || '',
            totalAmount: order.totalAmount.toNumber(), // Convertir Decimal en number
            orderStatus: order.status,
            paymentStatus: order.payment?.status || order.paymentStatus,
            orderDate: order.orderDate.toISOString(),
            paymentMethod: order.payment?.paymentMethod || null,
            paymentTransactionId: order.payment?.transactionId || null,
            paymentDate: order.payment?.paymentDate?.toISOString() || null,
        }));

        return NextResponse.json({
            success: true,
            totalProducts,
            totalOrders,
            pendingOrders,
            totalRevenue: totalRevenueResult._sum.totalAmount?.toNumber() || 0, // Convertir Decimal en number
            totalUsers,
            recentOrders: formattedRecentOrders,
            ordersPerMonth,
            revenuePerMonth,
            message: "Dashboard stats fetched successfully.",
        }, { status: 200 });

    } catch (_error: unknown) {
        const message = _error instanceof Error ? _error.message : String(_error);
        console.error("Error fetching dashboard stats:", _error);
        return NextResponse.json({ success: false, message: `Server error fetching dashboard stats: ${message}` }, { status: 500 });
    }
}
