import { useState, useMemo } from 'react';

type TeamEntry = {
  id: number;
  name: string;
  odds: string;
  status: 'win' | 'lose' | 'draw' | null;
};

type Combination = {
  teams: TeamEntry[];
  totalOdds: number;
  isWinner: boolean | null;
  drawCount: number;
  effectiveTeams: number;
};

export const RoundRobinCalculator = () => {
  const [risk, setRisk] = useState<string>('');
  const [teams, setTeams] = useState<TeamEntry[]>([
    { id: 1, name: '', odds: '', status: null },
    { id: 2, name: '', odds: '', status: null },
    { id: 3, name: '', odds: '', status: null },
  ]);
  const [combinationSize, setCombinationSize] = useState<number>(2);

  // Función para calcular el número de combinaciones posibles
  const calculateCombinationCount = (n: number, r: number): number => {
    const factorial = (num: number): number => {
      if (num <= 1) return 1;
      return num * factorial(num - 1);
    };
    return factorial(n) / (factorial(r) * factorial(n - r));
  };

  // Calcular las opciones disponibles de tamaño de combinación
  const availableCombinationSizes = useMemo(() => {
    const sizes: { value: number; count: number }[] = [];
    for (let size = 2; size < teams.length; size++) {
      const count = calculateCombinationCount(teams.length, size);
      sizes.push({ value: size, count });
    }
    return sizes;
  }, [teams.length]);

  const handleAddTeam = () => {
    if (teams.length < 8) {
      setTeams([...teams, { 
        id: Date.now(),
        name: '', 
        odds: '', 
        status: null 
      }]);
    }
  };

  const handleDeleteTeam = (id: number) => {
    if (teams.length > 3) {
      setTeams(teams.filter(team => team.id !== id));
    }
  };

  const handleTeamChange = (id: number, field: keyof TeamEntry, value: string | TeamEntry['status']) => {
    setTeams(teams.map(team => 
      team.id === id ? { ...team, [field]: value } : team
    ));
  };

  // Función para generar todas las combinaciones posibles
  const generateCombinations = (arr: TeamEntry[], r: number): TeamEntry[][] => {
    if (r === 1) return arr.map(item => [item]);
    if (r === arr.length) return [arr];

    const combinations: TeamEntry[][] = [];
    const len = arr.length;

    for (let i = 0; i < len - r + 1; i++) {
      const firstElement = arr[i];
      const remainingElements = arr.slice(i + 1);
      const subCombinations = generateCombinations(remainingElements, r - 1);
      
      subCombinations.forEach(subComb => {
        combinations.push([firstElement, ...subComb]);
      });
    }

    return combinations;
  };

  // Calcular si una combinación es ganadora y contar empates
  const analyzeCombination = (combination: TeamEntry[]): { 
    isWinner: boolean | null;
    drawCount: number;
    effectiveTeams: number;
  } => {
    let drawCount = 0;
    let effectiveTeams = combination.length;
    
    // Si algún equipo no tiene estado, la combinación está pendiente
    if (combination.some(team => !team.status)) {
      return { isWinner: null, drawCount: 0, effectiveTeams };
    }

    // Contar empates y verificar perdedores
    for (const team of combination) {
      if (team.status === 'draw') {
        drawCount++;
        effectiveTeams--;
      } else if (team.status === 'lose') {
        return { isWinner: false, drawCount, effectiveTeams };
      }
    }

    // Si llegamos aquí, no hay perdedores
    return { 
      isWinner: true, 
      drawCount, 
      effectiveTeams
    };
  };

  // Calcular las cuotas totales de una combinación (excluyendo empates)
  const calculateTotalOdds = (combination: TeamEntry[]): number => {
    return combination.reduce((total, team) => {
      if (team.status === 'draw') return total;
      const odds = parseFloat(team.odds) || 1;
      return total * odds;
    }, 1);
  };

  // Calcular la ganancia o pérdida para una combinación específica
  const calculateCombinationResult = (
    combination: Combination,
    riskPerCombination: number
  ): number => {
    if (combination.isWinner === null) return 0;
    
    // Si todos son empates, devolver 0 (ni ganancia ni pérdida)
    if (combination.effectiveTeams === 0) {
      return 0;
    }

    // Si es perdedora, retornar el monto negativo
    if (!combination.isWinner) {
      return -riskPerCombination;
    }

    // Si es ganadora, calcular la ganancia
    return (riskPerCombination * combination.totalOdds) - riskPerCombination;
  };

  // Modificar el useMemo de combinations para que siempre calcule
  const combinations = useMemo(() => {
    const validTeams = teams.filter(team => team.name && team.odds);
    if (validTeams.length < combinationSize) return [];

    const allCombinations = generateCombinations(validTeams, combinationSize);
    return allCombinations.map(comb => {
      const analysis = analyzeCombination(comb);
      return {
        teams: comb,
        totalOdds: calculateTotalOdds(comb),
        isWinner: analysis.isWinner,
        drawCount: analysis.drawCount,
        effectiveTeams: analysis.effectiveTeams
      };
    });
  }, [teams, combinationSize]);

  // Calcular el resumen de resultados
  const summary = useMemo(() => {
    const totalCombinations = combinations.length;
    const winningCombinations = combinations.filter(c => c.isWinner === true).length;
    const losingCombinations = combinations.filter(c => c.isWinner === false).length;
    const pendingCombinations = combinations.filter(c => c.isWinner === null).length;

    const riskAmount = parseFloat(risk) || 0;
    const perCombinationRisk = riskAmount / (totalCombinations || 1);
    
    const results = combinations.reduce((acc, comb) => {
      const result = calculateCombinationResult(comb, perCombinationRisk);
      return {
        totalWin: acc.totalWin + (result > 0 ? result : 0),
        totalLoss: acc.totalLoss + (result < 0 ? -result : 0)
      };
    }, { totalWin: 0, totalLoss: 0 });

    return {
      totalCombinations,
      winningCombinations,
      losingCombinations,
      pendingCombinations,
      perCombinationRisk,
      totalWin: results.totalWin,
      totalLoss: results.totalLoss,
      netResult: results.totalWin - results.totalLoss
    };
  }, [combinations, risk]);

  // Función para generar el texto del resumen
  const generateSummaryText = (): string => {
    let text = '';
    
    combinations.forEach((combination, index) => {
      const teamNames = combination.teams.map(team => team.name).join(', ');
      const result = calculateCombinationResult(combination, summary.perCombinationRisk);
      const resultAbs = Math.abs(result);
      
      text += `Combinada ${index + 1}, conformados por los pronóstico: ${teamNames},\n`;
      if (result > 0) {
        text += `Te generó una ganancia de $${resultAbs.toFixed(2)}\n\n`;
      } else if (result < 0) {
        text += `Te generó una pérdida de $${resultAbs.toFixed(2)}\n\n`;
      } else {
        text += `No generó ganancia ni pérdida\n\n`;
      }
    });

    if (summary.netResult !== 0) {
      const resultText = summary.netResult > 0 
        ? `ganancia de $${summary.netResult.toFixed(2)}`
        : `pérdida de $${Math.abs(summary.netResult).toFixed(2)}`;
      text += `En este caso la ganancia de tu Round Robin sería de ${resultText}.`;
    } else {
      text += `En este caso tu Round Robin no generó ganancia ni pérdida.`;
    }

    return text;
  };

  const handleCopySummary = async () => {
    const text = generateSummaryText();
    try {
      await navigator.clipboard.writeText(text);
      // Aquí podrías agregar una notificación de éxito si lo deseas
    } catch (err) {
      console.error('Error al copiar:', err);
      // Aquí podrías agregar una notificación de error si lo deseas
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto pt-8">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">
          Calculadora Round Robin
        </h1>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Riesgo ($)
            </label>
            <input
              type="number"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm"
              placeholder="Ingrese el monto a arriesgar"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Tamaño de combinación
            </label>
            <select
              value={combinationSize}
              onChange={(e) => setCombinationSize(parseInt(e.target.value))}
              className="w-full p-2 pr-8 border rounded focus:ring-2 focus:ring-blue-500 appearance-none bg-white/50 backdrop-blur-sm"
            >
              {availableCombinationSizes.map(({ value, count }) => (
                <option key={value} value={value}>
                  {value} equipos por combinación ({count} combinaciones)
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none mt-8">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Equipos</h2>
            {teams.map((team) => (
              <div key={team.id} className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleTeamChange(team.id, 'name', e.target.value)}
                  className="flex-1 p-2 border rounded bg-white/50 backdrop-blur-sm"
                  placeholder="Nombre del equipo"
                />
                <input
                  type="number"
                  value={team.odds}
                  onChange={(e) => handleTeamChange(team.id, 'odds', e.target.value)}
                  className="w-24 p-2 border rounded bg-white/50 backdrop-blur-sm"
                  placeholder="Cuota"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTeamChange(team.id, 'status', 'win')}
                    className={`px-3 py-1 rounded ${
                      team.status === 'win' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200'
                    }`}
                  >
                    G
                  </button>
                  <button
                    onClick={() => handleTeamChange(team.id, 'status', 'draw')}
                    className={`px-3 py-1 rounded ${
                      team.status === 'draw' 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-gray-200'
                    }`}
                  >
                    E
                  </button>
                  <button
                    onClick={() => handleTeamChange(team.id, 'status', 'lose')}
                    className={`px-3 py-1 rounded ${
                      team.status === 'lose' 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-200'
                    }`}
                  >
                    P
                  </button>
                  {teams.length > 3 && (
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="px-3 py-1 rounded bg-red-500 text-white"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
            ))}
            {teams.length < 8 && (
              <button
                onClick={handleAddTeam}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Agregar Equipo
              </button>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Resultados</h2>
              <button
                onClick={handleCopySummary}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                title="Copiar resumen"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                Copiar Resumen
              </button>
            </div>

            <div className="bg-white/30 backdrop-blur-sm rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-2 text-gray-800">Resumen</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p>Total de combinaciones: {summary.totalCombinations}</p>
                  <p>Combinaciones ganadoras: {summary.winningCombinations}</p>
                  <p>Combinaciones perdedoras: {summary.losingCombinations}</p>
                  <p>Combinaciones pendientes: {summary.pendingCombinations}</p>
                </div>
                <div>
                  <p>Riesgo por combinación: ${summary.perCombinationRisk.toFixed(2)}</p>
                  <p className="text-green-600">Ganancias: ${summary.totalWin.toFixed(2)}</p>
                  <p className="text-red-600">Pérdidas: ${summary.totalLoss.toFixed(2)}</p>
                  <p className={`font-bold ${
                    summary.netResult >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Resultado neto: ${summary.netResult.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {combinations.map((combination, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg backdrop-blur-sm ${
                  combination.isWinner === true
                    ? 'bg-green-100/50'
                    : combination.isWinner === false
                    ? 'bg-red-100/50'
                    : 'bg-gray-100/50'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex justify-between items-center">
                    <div>
                      {combination.teams.map(team => team.name).join(' + ')}
                    </div>
                    <div className="font-medium">
                      {combination.totalOdds.toFixed(2)}
                    </div>
                  </div>
                  {combination.drawCount > 0 && (
                    <div className="text-sm text-gray-600 mt-1">
                      {combination.drawCount} empate(s) - {combination.effectiveTeams} equipo(s) efectivo(s)
                    </div>
                  )}
                  {combination.isWinner !== null && (
                    <div className={`text-sm ${
                      combination.isWinner ? 'text-green-600' : 'text-red-600'
                    } mt-1`}>
                      {combination.isWinner ? 'Ganancia' : 'Pérdida'}: ${Math.abs(
                        calculateCombinationResult(combination, summary.perCombinationRisk)
                      ).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 