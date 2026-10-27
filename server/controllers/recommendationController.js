const Cattle = require('../models/Cattle');
const YieldPrediction = require('../models/YieldPrediction');
const yieldService = require('../services/yieldService');

// Next-session forecast for one cow plus its recent judgements
exports.getForCattle = async (req, res) => {
  try {
    const cow = await Cattle.getCattleById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Cattle not found' });
    if (cow.category !== 'Cow') return res.status(400).json({ error: 'Yield insight is only available for cows' });
    const [forecast, judgements] = await Promise.all([
      yieldService.forecastNext(cow.cattle_id),
      YieldPrediction.forCattle(cow.cattle_id, 30)
    ]);
    res.json({ cattle_id: cow.cattle_id, forecast, judgements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load yield insight' });
  }
};

// Low and high readings across the herd
exports.getAlerts = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    res.json({ days, alerts: await YieldPrediction.recentAlerts(days) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load yield alerts' });
  }
};
