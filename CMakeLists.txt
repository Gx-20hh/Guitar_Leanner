cmake_minimum_required(VERSION 3.16)
project(guitar_learner VERSION 0.0.1 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# 所有源码（含 vendored JUCE）均为 UTF-8 无 BOM；MSVC 默认按 ANSI 代码页(936)读取，
# 会对含中文注释/harfbuzz 的 UTF-8 文件产生 C4819 并破坏后续行 token 化。
# /utf-8 将源码字符集与执行字符集都明确为 UTF-8。
if(MSVC)
  add_compile_options(/utf-8)
endif()

# 启用 JUCE WebView2 后端（Windows）。JUCE 模块头默认 JUCE_USE_WIN_WEBVIEW2=0，
# 需在 add_subdirectory 前全局定义以让其生效（同时作用于 juce_gui_extra 模块与我们的目标）。
set(JUCE_WEBVIEW2_PACKAGE_LOCATION D:/GuitarLearner/packages CACHE PATH "" FORCE)
add_compile_definitions(JUCE_USE_WIN_WEBVIEW2=1)

# JUCE 9.0.3 锁定版本。源码来源：官方仓库 tag 9.0.3。
# 尚未将 JUCE 作为 git 子模块；构建期需由本机检出或下载到 JUCE_SOURCE_DIR。
# 后续可改为 FetchContent 锁 tag，见 docs/validation/t7-native.md。
if(NOT DEFINED JUCE_SOURCE_DIR)
  set(JUCE_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/JUCE")
endif()

if(NOT EXISTS "${JUCE_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "JUCE not found at ${JUCE_SOURCE_DIR}. "
          "Set -DJUCE_SOURCE_DIR=<path to JUCE 9.0.3 checkout> or run "
          "'git clone --branch 9.0.3 https://github.com/juce-framework/JUCE.git ${JUCE_SOURCE_DIR}'")
endif()

# JUCE 构建接口（JUCE 9.x 官方 CMake）
option(JUCE_BUILD_EXTRAS "Build JUCE extras" OFF)
list(APPEND CMAKE_MODULE_PATH "${JUCE_SOURCE_DIR}/tools/modules")
add_subdirectory("${JUCE_SOURCE_DIR}" juce)

# 库：guitar_learner_native —— 桥接校验器（纯测试逻辑，可独立于 GUI 编译）
add_library(guitar_learner_native STATIC
  native/bridge/guitar_bridge_protocol.cpp
)
target_include_directories(guitar_learner_native PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/native
  ${CMAKE_CURRENT_SOURCE_DIR}/native/bridge
  ${CMAKE_CURRENT_SOURCE_DIR}/contracts
)
target_link_libraries(guitar_learner_native PUBLIC
  juce::juce_gui_extra
  juce::juce_core
)
if(MSVC)
  target_compile_options(guitar_learner_native PRIVATE /W4 /permissive-)
endif()

# 可执行：GuitarLearner.exe —— WebView2 宿主（gui + 桥接注册）
add_executable(GuitarLearner
  native/app/main_juce.cpp
  native/app/main_component.cpp
  native/app/webview_host.cpp
  native/bridge/guitar_bridge_protocol.cpp
)
target_include_directories(GuitarLearner PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/native
  ${CMAKE_CURRENT_SOURCE_DIR}/contracts
)
target_link_libraries(GuitarLearner PRIVATE
  guitar_learner_native
  juce::juce_gui_extra
  juce::juce_core
)
if(MSVC)
  set_target_properties(GuitarLearner PROPERTIES WIN32_EXECUTABLE TRUE)
target_compile_options(GuitarLearner PRIVATE /W4 /permissive-)
endif()

# 复制前端打包产物到 exe 旁 ui/ 目录（仅复制；不修改 frontend 源码）
# 前端打包由 Pi 负责；构建时若 frontend/dist 存在则复制，缺席则告警（不失败）。
add_custom_command(TARGET GuitarLearner POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
    "${CMAKE_CURRENT_SOURCE_DIR}/frontend/dist"
    "$<TARGET_FILE_DIR:GuitarLearner>/ui"
  # 复制失败不中止构建：T7 首轮可能尚无 dist
  COMMAND ${CMAKE_COMMAND} -E true
)

# 原生协议测试
enable_testing()
add_executable(guitar_bridge_protocol_tests
  tests/integration/guitar_bridge_protocol_tests.cpp
  native/bridge/guitar_bridge_protocol.cpp
)
target_include_directories(guitar_bridge_protocol_tests PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/native
  ${CMAKE_CURRENT_SOURCE_DIR}/contracts
  ${JUCE_SOURCE_DIR}/modules
)
target_link_libraries(guitar_bridge_protocol_tests PRIVATE
  guitar_learner_native
  juce::juce_core
)
if(MSVC)
  target_compile_options(guitar_bridge_protocol_tests PRIVATE /W4 /permissive-)
endif()
add_test(NAME guitar_bridge_protocol_tests COMMAND guitar_bridge_protocol_tests)
