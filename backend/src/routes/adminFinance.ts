import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/schema";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/roles.middleware";

const PG_INT_MAX = 2_147_483_647;

function parseDateOnlyToUtcNoon(value: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export const adminFinanceRoutes = new Elysia({ prefix: "/admin-finance" })
  .use(authMiddleware)
  .use(requireRoles(["ADMIN", "BACKOFFICE"]))
  .get("/transactions", async ({ set }) => {
    try {
      const [transactions, aggregate] = await prisma.$transaction([
        prisma.financeTransaction.findMany({
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            description: true,
            amount: true,
            occurredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.financeTransaction.aggregate({ _sum: { amount: true } }),
      ]);

      return {
        transactions,
        summary: { totalIncome: aggregate._sum.amount ?? 0 },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        set.status = 500;
        return {
          error: "Tabel transaksi finance belum ada. Jalankan prisma migrate terlebih dahulu.",
        };
      }

      set.status = 500;
      return { error: "Internal Server Error" };
    }
  })
  .post(
    "/transactions",
    async ({ body, set }) => {
      const occurredAt = parseDateOnlyToUtcNoon(body.occurredAt);
      if (!occurredAt) {
        set.status = 400;
        return { error: "Invalid occurredAt (expected YYYY-MM-DD)" };
      }

      if (!Number.isSafeInteger(body.amount) || body.amount < 0 || body.amount > PG_INT_MAX) {
        set.status = 400;
        return { error: `Jumlah maksimal adalah ${PG_INT_MAX}.` };
      }

      try {
        const transaction = await prisma.financeTransaction.create({
          data: {
            description: body.description.trim(),
            amount: body.amount,
            occurredAt,
          },
          select: {
            id: true,
            description: true,
            amount: true,
            occurredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        set.status = 201;
        return { transaction };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
          set.status = 500;
          return {
            error: "Tabel transaksi finance belum ada. Jalankan prisma migrate terlebih dahulu.",
          };
        }

        set.status = 500;
        return { error: "Internal Server Error" };
      }
    },
    {
      body: t.Object({
        description: t.String({ minLength: 1 }),
        amount: t.Integer({ minimum: 0, maximum: PG_INT_MAX }),
        occurredAt: t.String({ minLength: 10 }),
      }),
    }
  )
  .patch(
    "/transactions/:id",
    async ({ params, body, set }) => {
      const nextOccurredAt =
        typeof body.occurredAt === "string" ? parseDateOnlyToUtcNoon(body.occurredAt) : undefined;

      if (typeof body.occurredAt === "string" && !nextOccurredAt) {
        set.status = 400;
        return { error: "Invalid occurredAt (expected YYYY-MM-DD)" };
      }

      if (
        typeof body.amount === "number" &&
        (!Number.isSafeInteger(body.amount) || body.amount < 0 || body.amount > PG_INT_MAX)
      ) {
        set.status = 400;
        return { error: `Jumlah maksimal adalah ${PG_INT_MAX}.` };
      }

      try {
        const transaction = await prisma.financeTransaction.update({
          where: { id: params.id },
          data: {
            ...(body.description !== undefined ? { description: body.description.trim() } : {}),
            ...(body.amount !== undefined ? { amount: body.amount } : {}),
            ...(nextOccurredAt ? { occurredAt: nextOccurredAt } : {}),
          },
          select: {
            id: true,
            description: true,
            amount: true,
            occurredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return { transaction };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          set.status = 404;
          return { error: "Transaction not found" };
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
          set.status = 500;
          return {
            error: "Tabel transaksi finance belum ada. Jalankan prisma migrate terlebih dahulu.",
          };
        }

        set.status = 500;
        return { error: "Internal Server Error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        description: t.Optional(t.String({ minLength: 1 })),
        amount: t.Optional(t.Integer({ minimum: 0, maximum: PG_INT_MAX })),
        occurredAt: t.Optional(t.String({ minLength: 10 })),
      }),
    }
  )
  .delete(
    "/transactions/:id",
    async ({ params, set }) => {
      try {
        const transaction = await prisma.financeTransaction.delete({
          where: { id: params.id },
          select: {
            id: true,
            description: true,
            amount: true,
            occurredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return { transaction };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          set.status = 404;
          return { error: "Transaction not found" };
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
          set.status = 500;
          return {
            error: "Tabel transaksi finance belum ada. Jalankan prisma migrate terlebih dahulu.",
          };
        }

        set.status = 500;
        return { error: "Internal Server Error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
