const paths = ["/movimientos", "/resumen", "/casas", "/cargos", "/tipos-de-cargo", "/tipos-de-gasto"];
export function safeReturnPath(value) {
  if (typeof value !== "string" || /[\\\x00-\x20]/.test(value)) return "/resumen";
  return paths.includes(value.split(/[?#]/)[0]) ? value : "/resumen";
}
