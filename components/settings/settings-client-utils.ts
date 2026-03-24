/**
 * 设置页提示文案工具
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/24
 */
export interface SettingsToastState {
  title: string
  description?: string
  tone?: "default" | "warning" | "success" | "error"
}

export function buildModelTestToast(
  success: boolean,
  data: { error?: string }
): SettingsToastState {
  if (success) {
    return {
      title: "连通性测试成功 ✓",
      tone: "success"
    }
  }
  return {
    title: "测试失败",
    description: data.error?.trim() || "请检查配置",
    tone: "error"
  }
}
