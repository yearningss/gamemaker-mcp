/// @description MCP Commands - Shader Tools

function mcp_register_commands_shader() {

    mcp_route("get_shader_list", function(_params) {
        var _assets = mcp_get_assets_by_type(asset_shader);
        return {
            shaders: _assets,
            count: array_length(_assets)
        };
    });

    mcp_route("get_shader_info", function(_params) {
        if (!variable_struct_exists(_params, "shader_name")) {
            return { __error: "Missing required parameter: shader_name", __code: -32602 };
        }

        var _sh = asset_get_index(_params.shader_name);
        if (_sh < 0) {
            return { __error: "Shader not found: " + _params.shader_name, __code: -32602 };
        }

        return {
            name: _params.shader_name,
            index: _sh,
            is_compiled: shader_is_compiled(_sh)
        };
    });

    mcp_route("get_shader_uniforms", function(_params) {
        if (!variable_struct_exists(_params, "shader_name")) {
            return { __error: "Missing required parameter: shader_name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "uniform_names")) {
            return { __error: "Missing required parameter: uniform_names", __code: -32602 };
        }

        var _sh = asset_get_index(_params.shader_name);
        if (_sh < 0) {
            return { __error: "Shader not found: " + _params.shader_name, __code: -32602 };
        }

        var _names = _params.uniform_names;
        var _uniforms = [];
        for (var _i = 0; _i < array_length(_names); _i++) {
            var _handle = shader_get_uniform(_sh, _names[_i]);
            array_push(_uniforms, {
                name: _names[_i],
                handle: _handle
            });
        }

        return {
            shader_name: _params.shader_name,
            uniforms: _uniforms
        };
    });

    mcp_route("set_shader_uniform", function(_params) {
        if (!variable_struct_exists(_params, "shader_name")) {
            return { __error: "Missing required parameter: shader_name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "uniform_name")) {
            return { __error: "Missing required parameter: uniform_name", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "values")) {
            return { __error: "Missing required parameter: values", __code: -32602 };
        }

        var _sh = asset_get_index(_params.shader_name);
        if (_sh < 0) {
            return { __error: "Shader not found: " + _params.shader_name, __code: -32602 };
        }

        var _uniforms = {};
        _uniforms[$ _params.uniform_name] = _params.values;

        array_push(global.__mcp_draw_queue, {
            type: "set_shader",
            shader: _params.shader_name,
            uniforms: _uniforms
        });

        return {
            shader_name: _params.shader_name,
            uniform_name: _params.uniform_name,
            values: _params.values,
            queued: true
        };
    });

    mcp_route("set_shader", function(_params) {
        if (!variable_struct_exists(_params, "shader_name")) {
            return { __error: "Missing required parameter: shader_name", __code: -32602 };
        }

        var _sh = asset_get_index(_params.shader_name);
        if (_sh < 0) {
            return { __error: "Shader not found: " + _params.shader_name, __code: -32602 };
        }

        array_push(global.__mcp_draw_queue, {
            type: "set_shader",
            shader: _params.shader_name,
            uniforms: _params[$ "uniforms"] ?? {}
        });

        return {
            shader_name: _params.shader_name,
            queued: true
        };
    });

    mcp_route("reset_shader", function(_params) {
        array_push(global.__mcp_draw_queue, {
            type: "reset_shader"
        });

        return {
            reset: true,
            queued: true
        };
    });

    mcp_route("is_shader_compiled", function(_params) {
        if (!variable_struct_exists(_params, "shader_name")) {
            return { __error: "Missing required parameter: shader_name", __code: -32602 };
        }

        var _sh = asset_get_index(_params.shader_name);
        if (_sh < 0) {
            return { __error: "Shader not found: " + _params.shader_name, __code: -32602 };
        }

        return {
            shader_name: _params.shader_name,
            compiled: shader_is_compiled(_sh)
        };
    });

}
