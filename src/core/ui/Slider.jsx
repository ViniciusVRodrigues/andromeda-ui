/* Slider da casa sobre Radix Slider — substitui o input[type=range] manual do
 * AllocationSlider mantendo a mesma pele de tokens. */

import * as SliderPrimitive from "@radix-ui/react-slider";
import "./ui.css";

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, ariaLabel }) {
  return (
    <SliderPrimitive.Root
      className="ui-slider"
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
    >
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      {value.map((_, i) => (
        <SliderPrimitive.Thumb key={i} className="ui-slider-thumb" />
      ))}
    </SliderPrimitive.Root>
  );
}

export default Slider;
