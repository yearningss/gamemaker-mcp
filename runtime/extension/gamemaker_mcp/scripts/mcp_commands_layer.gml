/// @description MCP Commands - Layer Management

function mcp_register_commands_layer() {

    mcp_route("get_layers", function(_params) {
        var _layer_ids = layer_get_all();
        var _layers = [];

        for (var _i = 0; _i < array_length(_layer_ids); _i++) {
            var _lid = _layer_ids[_i];
            array_push(_layers, {
                id: _lid,
                name: layer_get_name(_lid),
                depth: layer_get_depth(_lid),
                visible: layer_get_visible(_lid),
                hspeed: layer_get_hspeed(_lid),
                vspeed: layer_get_vspeed(_lid)
            });
        }

        return { layers: _layers, count: array_length(_layers) };
    });

    mcp_route("get_layer_instances", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _elements = layer_get_all_elements(_lid);
        var _instances = [];

        for (var _i = 0; _i < array_length(_elements); _i++) {
            var _el = _elements[_i];
            if (layer_get_element_type(_el) == layerelementtype_instance) {
                var _inst = layer_instance_get_instance(_el);
                if (instance_exists(_inst)) {
                    array_push(_instances, {
                        id: _inst,
                        object_name: object_get_name(_inst.object_index),
                        x: _inst.x,
                        y: _inst.y,
                        visible: _inst.visible
                    });
                }
            }
        }

        return {
            layer_name: _params.layer_name,
            instances: _instances,
            count: array_length(_instances)
        };
    });

    mcp_route("get_layer_elements", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _elements = layer_get_all_elements(_lid);
        var _result = [];

        for (var _i = 0; _i < array_length(_elements); _i++) {
            var _el = _elements[_i];
            var _type = layer_get_element_type(_el);
            var _type_name = "unknown";

            switch (_type) {
                case layerelementtype_instance:   _type_name = "instance"; break;
                case layerelementtype_sprite:      _type_name = "sprite"; break;
                case layerelementtype_background:  _type_name = "background"; break;
                case layerelementtype_tilemap:     _type_name = "tilemap"; break;
                case layerelementtype_particlesystem: _type_name = "particlesystem"; break;
                case layerelementtype_sequence:    _type_name = "sequence"; break;
            }

            array_push(_result, {
                element_id: _el,
                type: _type_name
            });
        }

        return {
            layer_name: _params.layer_name,
            elements: _result,
            count: array_length(_result)
        };
    });

    mcp_route("set_layer_visible", function(_params) {
        if (!variable_struct_exists(_params, "layer_name") ||
            !variable_struct_exists(_params, "visible")) {
            return { __error: "Missing required parameters: layer_name, visible", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        layer_set_visible(_lid, _params.visible);
        return {
            success: true,
            layer_name: _params.layer_name,
            visible: _params.visible
        };
    });

    mcp_route("set_layer_depth", function(_params) {
        if (!variable_struct_exists(_params, "layer_name") ||
            !variable_struct_exists(_params, "depth")) {
            return { __error: "Missing required parameters: layer_name, depth", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        layer_depth(_lid, _params.depth);
        return {
            success: true,
            layer_name: _params.layer_name,
            depth: _params.depth
        };
    });

    mcp_route("get_layer_info", function(_params) {
        if (!variable_struct_exists(_params, "layer_name")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _lid = layer_get_id(_params.layer_name);
        if (_lid == -1) {
            return { __error: "Layer not found: " + _params.layer_name, __code: -32602 };
        }

        var _elements = layer_get_all_elements(_lid);
        var _element_counts = { instance: 0, sprite: 0, background: 0, tilemap: 0, other: 0 };

        for (var _i = 0; _i < array_length(_elements); _i++) {
            var _type = layer_get_element_type(_elements[_i]);
            switch (_type) {
                case layerelementtype_instance:    _element_counts.instance++; break;
                case layerelementtype_sprite:      _element_counts.sprite++; break;
                case layerelementtype_background:  _element_counts.background++; break;
                case layerelementtype_tilemap:     _element_counts.tilemap++; break;
                default: _element_counts.other++; break;
            }
        }

        return {
            name: layer_get_name(_lid),
            id: _lid,
            depth: layer_get_depth(_lid),
            visible: layer_get_visible(_lid),
            hspeed: layer_get_hspeed(_lid),
            vspeed: layer_get_vspeed(_lid),
            x: layer_get_x(_lid),
            y: layer_get_y(_lid),
            element_count: array_length(_elements),
            element_types: _element_counts
        };
    });

}
