# 随包许可来源

“设置 → 关于软件”展示上游 LICENSE、安装的生产依赖自带版权/许可文件，以及 Android 运行时依赖许可；全文随 APK 提供，无需联网。`scripts/generate-notices.mjs` 在每次构建时生成 `src/generated/notices.ts`，不修改依赖源码。

- Android 清单 `android-runtime.json`：2026-11-17 从 Gradle `debugRuntimeClasspath.incoming.resolutionResult` 的 68 个外部组件收集 Maven POM 许可及缓存 JAR/AAR 的 LICENSE/NOTICE。Guava listenablefuture 1.0 的许可继承已核验的 guava-parent 26.0-android POM。升级原生依赖后应重新收集清单。
- Apache-2.0 全文来自 https://www.apache.org/licenses/LICENSE-2.0.txt 。
- 部分 micromark 2.0.0 子包未包含独立 license，按各包 readme 的许可链接补充仓库根许可：https://github.com/micromark/micromark/blob/main/license 。
- Capgo InAppBrowser 8.27.9 使用 MPL-2.0，未修改其源文件；应用中提供对应源代码标签链接 https://github.com/Cap-go/capacitor-inappbrowser/tree/8.27.9 ，已核验标签存在。

原始上游 MIT 许可证保留在项目根目录 LICENSE，构建时继续复制到 dist/LICENSE。应用自身的许可证未替换依赖的独立许可。
