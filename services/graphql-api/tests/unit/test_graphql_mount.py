"""The app imports and serves GraphQL over HTTP and WebSocket on /graphql."""
from fastapi.routing import APIRoute, APIWebSocketRoute
from fastapi.testclient import TestClient

import main


# FastAPI wraps included routers, so the GraphQL routes are checked on the
# router itself; the client tests below prove it is reachable at /graphql.
def _routes(kind):
    return [r for r in main.graphql_app.routes if isinstance(r, kind)]


def test_graphql_websocket_route_registered():
    assert _routes(APIWebSocketRoute), "GraphQL router has no WebSocket route"


def test_graphql_http_route_registered():
    methods = set().union(*(r.methods for r in _routes(APIRoute)))
    assert {"GET", "POST"} <= methods


def test_graphql_http_query_answers():
    with TestClient(main.app) as client:
        resp = client.post("/graphql", json={"query": "{ __typename }"})
    assert resp.status_code == 200
    assert resp.json() == {"data": {"__typename": "Query"}}


def test_graphql_websocket_accepts_transport_ws():
    with TestClient(main.app) as client:
        with client.websocket_connect("/graphql", subprotocols=["graphql-transport-ws"]) as ws:
            ws.send_json({"type": "connection_init"})
            assert ws.receive_json()["type"] == "connection_ack"
