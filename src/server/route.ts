// 路由处理器包装：统一处理业务错误与未知异常。
import { NextResponse } from "next/server";
import { TrainingError } from "@/server/training";
import { fail } from "@/server/http";

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof TrainingError) return fail(e.status, e.message);
      console.error(e);
      return NextResponse.json({ error: "服务器开小差了，请稍后再试" }, { status: 500 });
    }
  };
}
