"""Domain failures that carry the HTTP status an API layer should report."""


class CatalogError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail
