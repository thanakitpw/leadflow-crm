import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { TRPCContext } from '@/lib/trpc/context'

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure

// ============================================================
// Middleware: ตรวจสอบ session — ต้อง login ก่อน
// ============================================================
const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
    })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  })
})

// ============================================================
// Procedures
// ============================================================

/** ต้อง login — ใช้ใน routers ทุกตัวที่ต้องการ auth */
export const protectedProcedure = t.procedure.use(isAuthenticated)
