/// @description MCP Commands - Test Framework Tools

function mcp_register_commands_test() {

    mcp_route("assert_equals", function(_params) {
        if (!variable_struct_exists(_params, "expected")) {
            return { __error: "Missing required parameter: expected", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "actual")) {
            return { __error: "Missing required parameter: actual", __code: -32602 };
        }

        var _test_name = _params[$ "test_name"] ?? "assert_equals";
        var _expected = _params.expected;
        var _actual = _params.actual;
        var _passed = (_expected == _actual);

        // Record result
        array_push(global.__mcp_test_results, {
            test_name: _test_name,
            type: "assert_equals",
            passed: _passed,
            expected: _expected,
            actual: _actual,
            timestamp: current_time
        });

        return {
            test_name: _test_name,
            passed: _passed,
            expected: _expected,
            actual: _actual
        };
    });

    mcp_route("assert_instance_exists", function(_params) {
        if (!variable_struct_exists(_params, "object_name")) {
            return { __error: "Missing required parameter: object_name", __code: -32602 };
        }

        var _test_name = _params[$ "test_name"] ?? "assert_instance_exists";
        var _object_name = _params.object_name;
        var _obj = asset_get_index(_object_name);

        if (_obj < 0) {
            var _result = {
                test_name: _test_name,
                passed: false,
                object_name: _object_name,
                count: 0,
                min_count: _params[$ "min_count"] ?? 1,
                error: "Object asset not found: " + _object_name
            };
            array_push(global.__mcp_test_results, {
                test_name: _test_name,
                type: "assert_instance_exists",
                passed: false,
                object_name: _object_name,
                error: "Object asset not found",
                timestamp: current_time
            });
            return _result;
        }

        var _count = instance_number(_obj);
        var _min = _params[$ "min_count"] ?? 1;
        var _passed = (_count >= _min);

        // Record result
        array_push(global.__mcp_test_results, {
            test_name: _test_name,
            type: "assert_instance_exists",
            passed: _passed,
            object_name: _object_name,
            count: _count,
            min_count: _min,
            timestamp: current_time
        });

        return {
            test_name: _test_name,
            passed: _passed,
            object_name: _object_name,
            count: _count,
            min_count: _min
        };
    });

    mcp_route("assert_variable_value", function(_params) {
        if (!variable_struct_exists(_params, "variable")) {
            return { __error: "Missing required parameter: variable", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "operator")) {
            return { __error: "Missing required parameter: operator", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "expected")) {
            return { __error: "Missing required parameter: expected", __code: -32602 };
        }

        var _test_name = _params[$ "test_name"] ?? "assert_variable_value";
        var _inst_id = _params[$ "instance_id"] ?? -1;
        var _variable = _params.variable;
        var _operator = _params.operator;
        var _expected = _params.expected;
        var _scope = "instance";

        // Determine scope: instance_id == -1 or missing means global variable
        if (_inst_id == -1 || !variable_struct_exists(_params, "instance_id")) {
            _scope = "global";
        }

        var _actual_value;

        if (_scope == "global") {
            // Global variable lookup
            if (!variable_global_exists(_variable)) {
                var _result = {
                    test_name: _test_name,
                    passed: false,
                    variable: _variable,
                    scope: "global",
                    actual_value: undefined,
                    operator: _operator,
                    expected: _expected,
                    error: "Global variable does not exist: " + _variable
                };
                array_push(global.__mcp_test_results, {
                    test_name: _test_name,
                    type: "assert_variable_value",
                    passed: false,
                    error: "Global variable does not exist: " + _variable,
                    timestamp: current_time
                });
                return _result;
            }
            _actual_value = variable_global_get(_variable);
        } else {
            // Instance variable lookup
            if (!instance_exists(_inst_id)) {
                var _result = {
                    test_name: _test_name,
                    passed: false,
                    variable: _variable,
                    scope: "instance",
                    actual_value: undefined,
                    operator: _operator,
                    expected: _expected,
                    error: "Instance does not exist: " + string(_inst_id)
                };
                array_push(global.__mcp_test_results, {
                    test_name: _test_name,
                    type: "assert_variable_value",
                    passed: false,
                    error: "Instance does not exist",
                    timestamp: current_time
                });
                return _result;
            }
            _actual_value = variable_instance_get(_inst_id, _variable);
        }

        // Compare with operator
        var _passed = false;
        switch (_operator) {
            case "eq":  _passed = (_actual_value == _expected); break;
            case "ne":  _passed = (_actual_value != _expected); break;
            case "gt":  _passed = (_actual_value > _expected); break;
            case "lt":  _passed = (_actual_value < _expected); break;
            case "gte": _passed = (_actual_value >= _expected); break;
            case "lte": _passed = (_actual_value <= _expected); break;
            default:
                return { __error: "Invalid operator: " + _operator + ". Use eq, ne, gt, lt, gte, lte", __code: -32602 };
        }

        // Record result
        array_push(global.__mcp_test_results, {
            test_name: _test_name,
            type: "assert_variable_value",
            passed: _passed,
            variable: _variable,
            actual_value: _actual_value,
            operator: _operator,
            expected: _expected,
            timestamp: current_time
        });

        return {
            test_name: _test_name,
            passed: _passed,
            variable: _variable,
            actual_value: _actual_value,
            operator: _operator,
            expected: _expected
        };
    });

    mcp_route("get_test_results", function(_params) {
        return {
            results: global.__mcp_test_results,
            count: array_length(global.__mcp_test_results)
        };
    });

    mcp_route("clear_test_results", function(_params) {
        global.__mcp_test_results = [];
        return {
            cleared: true
        };
    });

}
