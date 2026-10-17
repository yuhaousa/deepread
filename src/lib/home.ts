/** 各角色登录后的首页（浏览器、proxy、服务器共用，不依赖任何服务端模块） */
export const homeFor = (role: string) => (role === "STUDENT" ? "/" : role === "ADMIN" ? "/admin" : "/teacher");
