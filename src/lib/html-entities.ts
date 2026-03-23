/**
 * HTML 实体解码工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import { decode } from "he"

export function decodeHtmlEntities(value: string) {
  return decode(value).replace(/\u00a0/g, " ")
}
