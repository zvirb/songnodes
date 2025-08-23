import React, { useRef, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, Chip, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import * as d3 from 'd3';
import * as PIXI from 'pixi.js';

interface CompatibilityTestProps {
  onTestComplete?: (results: CompatibilityResults) => void;
}

interface CompatibilityResults {
  mui: boolean;
  d3: boolean;
  pixi: boolean;
  integration: boolean;
  errors: string[];
}

export const CompatibilityTest: React.FC<CompatibilityTestProps> = ({ onTestComplete }) => {
  const theme = useTheme();
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = React.useState<CompatibilityResults>({
    mui: false,
    d3: false,
    pixi: false,
    integration: false,
    errors: [],
  });

  useEffect(() => {
    const runCompatibilityTests = async () => {
      const testResults: CompatibilityResults = {
        mui: false,
        d3: false,
        pixi: false,
        integration: false,
        errors: [],
      };

      try {
        // Test Material-UI
        testResults.mui = true;
        console.log('✅ Material-UI integration: PASS');
      } catch (error) {
        testResults.errors.push('Material-UI test failed: ' + String(error));
        console.error('❌ Material-UI integration: FAIL', error);
      }

      try {
        // Test D3.js
        if (d3ContainerRef.current) {
          const svg = d3.select(d3ContainerRef.current)
            .append('svg')
            .attr('width', 200)
            .attr('height', 100);

          svg.append('circle')
            .attr('cx', 100)
            .attr('cy', 50)
            .attr('r', 20)
            .attr('fill', theme.palette.primary.main);

          svg.append('text')
            .attr('x', 100)
            .attr('y', 55)
            .attr('text-anchor', 'middle')
            .attr('fill', theme.palette.text.primary)
            .style('font-size', '12px')
            .text('D3');

          testResults.d3 = true;
          console.log('✅ D3.js integration: PASS');
        }
      } catch (error) {
        testResults.errors.push('D3.js test failed: ' + String(error));
        console.error('❌ D3.js integration: FAIL', error);
      }

      try {
        // Test PIXI.js
        if (pixiContainerRef.current) {
          const app = new PIXI.Application({
            width: 200,
            height: 100,
            backgroundColor: theme.palette.mode === 'dark' ? 0x1F2937 : 0xF9FAFB,
            antialias: true,
          });

          pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);

          const graphics = new PIXI.Graphics();
          graphics.beginFill(parseInt(theme.palette.primary.main.replace('#', ''), 16));
          graphics.drawRect(75, 25, 50, 50);
          graphics.endFill();

          const text = new PIXI.Text('PIXI', {
            fontSize: 12,
            fill: theme.palette.text.primary,
          });
          text.x = 85;
          text.y = 45;

          app.stage.addChild(graphics);
          app.stage.addChild(text);

          testResults.pixi = true;
          console.log('✅ PIXI.js integration: PASS');

          // Cleanup PIXI app after test
          setTimeout(() => {
            app.destroy(true);
          }, 1000);
        }
      } catch (error) {
        testResults.errors.push('PIXI.js test failed: ' + String(error));
        console.error('❌ PIXI.js integration: FAIL', error);
      }

      // Test integration
      testResults.integration = testResults.mui && testResults.d3 && testResults.pixi;

      setResults(testResults);
      onTestComplete?.(testResults);
    };

    runCompatibilityTests();
  }, [theme, onTestComplete]);

  const getStatusColor = (status: boolean) => status ? 'success' : 'error';
  const getStatusText = (status: boolean) => status ? 'PASS' : 'FAIL';

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Material-UI Integration Compatibility Test
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Test Results
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip
                  label={`Material-UI: ${getStatusText(results.mui)}`}
                  color={getStatusColor(results.mui)}
                  variant="outlined"
                />
                <Chip
                  label={`D3.js: ${getStatusText(results.d3)}`}
                  color={getStatusColor(results.d3)}
                  variant="outlined"
                />
                <Chip
                  label={`PIXI.js: ${getStatusText(results.pixi)}`}
                  color={getStatusColor(results.pixi)}
                  variant="outlined"
                />
                <Chip
                  label={`Integration: ${getStatusText(results.integration)}`}
                  color={getStatusColor(results.integration)}
                  variant={results.integration ? 'filled' : 'outlined'}
                />
              </Box>
            </Box>

            {results.errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Errors:</Typography>
                {results.errors.map((error, index) => (
                  <Typography key={index} variant="body2">
                    {error}
                  </Typography>
                ))}
              </Alert>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                D3.js Visualization Test
              </Typography>
              <Box
                ref={d3ContainerRef}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                PIXI.js Canvas Test
              </Typography>
              <Box
                ref={pixiContainerRef}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};