import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SonicDNA } from '../services/geminiService';

interface Props {
  data: SonicDNA;
}

export default function SonicRadarChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const scores = [
      { axis: "Energy", value: data.energy },
      { axis: "Complexity", value: data.rhythmicComplexity },
      { axis: "Darkness", value: data.emotionalDarkness },
      { axis: "Vocal Clar.", value: data.vocalClarity },
      { axis: "Production", value: data.productionPolish }
    ];

    const width = 300;
    const height = 300;
    const margin = 50;
    const radius = Math.min(width, height) / 2 - margin;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const angleStep = (Math.PI * 2) / scores.length;

    // Background circles
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
        const r = (radius / levels) * i;
        g.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", "#27272a")
            .attr("stroke-dasharray", "4,4");
    }

    // Axes
    const axis = g.selectAll(".axis")
      .data(scores)
      .enter()
      .append("g")
      .attr("class", "axis");

    axis.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => radius * Math.cos(angleStep * i - Math.PI / 2))
      .attr("y2", (d, i) => radius * Math.sin(angleStep * i - Math.PI / 2))
      .attr("stroke", "#3f3f46")
      .attr("stroke-width", 1);

    axis.append("text")
      .attr("x", (d, i) => (radius + 20) * Math.cos(angleStep * i - Math.PI / 2))
      .attr("y", (d, i) => (radius + 20) * Math.sin(angleStep * i - Math.PI / 2))
      .attr("dy", "0.35em")
      .attr("text-anchor", (d, i) => {
        const x = Math.cos(angleStep * i - Math.PI / 2);
        if (Math.abs(x) < 0.1) return "middle";
        return x > 0 ? "start" : "end";
      })
      .attr("fill", "#a1a1aa")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .text(d => d.axis);

    // Data line
    const rScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, radius]);

    const line = d3.lineRadial<any>()
      .radius(d => rScale(d.value))
      .angle((d, i) => angleStep * i)
      .curve(d3.curveLinearClosed);

    const pathData = line(scores);

    // Area
    g.append("path")
      .attr("d", pathData)
      .attr("fill", "rgba(99, 102, 241, 0.2)")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 2)
      .attr("class", "radar-area")
      .style("opacity", 0)
      .transition()
      .duration(1000)
      .style("opacity", 1);

    // Points
    g.selectAll(".radar-point")
      .data(scores)
      .enter()
      .append("circle")
      .attr("class", "radar-point")
      .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleStep * i - Math.PI / 2))
      .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleStep * i - Math.PI / 2))
      .attr("r", 4)
      .attr("fill", "#6366f1")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0)
      .transition()
      .delay((d, i) => 500 + (i * 100))
      .duration(500)
      .style("opacity", 1);

  }, [data]);

  return (
    <div className="flex justify-center items-center p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
      <svg ref={svgRef} width={300} height={300} viewBox="0 0 300 300"></svg>
    </div>
  );
}
