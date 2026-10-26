
class EnergyModelRegistry:
    def __init__(self):
        self._models = {}

    def register(self, name, func):
        self._models[name] = func

    def get(self, name):
        return self._models.get(name)

energy_registry = EnergyModelRegistry()
energy_registry.register('default', lambda track: track.get('energy_score', 0.0))
