cmake_minimum_required(VERSION 3.25)

project(SYNTH_WEB VERSION 0.1.0 LANGUAGES NONE)

find_package(Python3 3.11 REQUIRED COMPONENTS Interpreter)

set(SYNTH_WEB_DIST "${CMAKE_BINARY_DIR}/dist")
add_custom_target(synth-web ALL
  COMMAND ${CMAKE_COMMAND} -E rm -rf "${SYNTH_WEB_DIST}"
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_CURRENT_SOURCE_DIR}/src" "${SYNTH_WEB_DIST}"
  COMMAND ${CMAKE_COMMAND} -E copy "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE" "${SYNTH_WEB_DIST}/LICENSE"
  COMMENT "Building independent synth-web ${PROJECT_VERSION} artifact"
)

add_custom_target(package
  COMMAND ${CMAKE_COMMAND} -E tar cf "${CMAKE_BINARY_DIR}/synth-web-${PROJECT_VERSION}.tar" --format=gnutar .
  WORKING_DIRECTORY "${SYNTH_WEB_DIST}"
  DEPENDS synth-web
  COMMENT "Packaging synth-web artifact"
)

include(CTest)
if(BUILD_TESTING)
  add_test(
    NAME synth-web-independent-runtime
    COMMAND ${Python3_EXECUTABLE} "${CMAKE_CURRENT_SOURCE_DIR}/tests/test_runtime.py" "${SYNTH_WEB_DIST}"
  )
endif()
