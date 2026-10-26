import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import { _rs as onLibResize } from '@rc-component/resize-observer/lib/utils/observerUtil';
import { spyElementPrototypes } from '@rc-component/util/lib/test/domHook';
import React from 'react';
import type { ListRef } from '../src';
import List, { type ListProps } from '../src';

const ITEM_HEIGHT = 20;

function genData(count: number) {
  return new Array(count).fill(null).map((_, index) => ({ id: String(index) }));
}

describe('List.scrollWidth', () => {
  let mockElement;
  let mockMouseEvent;
  let pageX: number;

  let holderHeight = 100;
  let holderWidth = 100;

  beforeAll(() => {
    mockElement = spyElementPrototypes(HTMLElement, {
      offsetHeight: {
        get() {
          if (this.classList.contains('rc-virtual-list-holder')) {
            return holderHeight;
          }
          return ITEM_HEIGHT;
        },
      },
      offsetWidth: {
        get() {
          return holderWidth;
        },
      },
      clientHeight: {
        get() {
          return holderHeight;
        },
      },
      getBoundingClientRect() {
        return {
          top: 0,
          bottom: holderHeight,
          left: 0,
          right: holderWidth,
          width: holderWidth,
          height: holderHeight,
        };
      },
    });

    mockMouseEvent = spyElementPrototypes(MouseEvent, {
      pageX: {
        get: () => pageX,
      },
    });
  });

  afterAll(() => {
    mockElement.mockRestore();
    mockMouseEvent.mockRestore();
  });

  beforeEach(() => {
    holderHeight = 100;
    holderWidth = 100;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function genList(props: Partial<ListProps<any>> & { ref?: any }) {
    const ret = render(
      <List component="ul" itemKey="id" {...(props as any)}>
        {({ id }) => <li>{id}</li>}
      </List>,
    );

    await act(async () => {
      onLibResize([
        {
          target: ret.container.querySelector('.rc-virtual-list-holder')!,
        } as ResizeObserverEntry,
      ]);

      await Promise.resolve();
    });

    return ret;
  }

  it('work', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
    });

    expect(container.querySelector('.rc-virtual-list-scrollbar-horizontal')).toBeTruthy();
    expect(container.querySelector('.rc-virtual-list-scrollbar-vertical')).toBeTruthy();
    expect(container.querySelector('.rc-virtual-list')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr) 8px',
      gridTemplateRows: 'minmax(0, 1fr) 8px',
    });
    expect(container.querySelector('.rc-virtual-list-holder')).toHaveStyle({ height: '92px' });
    expect(container.querySelector('.rc-virtual-list-scrollbar-slot-horizontal')).toHaveStyle({
      gridRow: '2',
    });
  });

  it('reserves only the horizontal scrollbar gutter when vertical content fits', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(2),
      scrollWidth: 1000,
    });

    expect(container.querySelector('.rc-virtual-list-scrollbar-vertical')).toBeNull();
    expect(container.querySelector('.rc-virtual-list-holder')).toHaveStyle({ height: '92px' });
    expect(container.querySelector('.rc-virtual-list')).toHaveStyle({
      gridTemplateRows: 'minmax(0, 1fr) 8px',
    });
  });

  it('matches reserved gutters to custom scrollbar dimensions', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
      styles: {
        verticalScrollBar: { width: 12 },
        horizontalScrollBar: { height: 6 },
      },
    });

    expect(container.querySelector('.rc-virtual-list')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr) 12px',
      gridTemplateRows: 'minmax(0, 1fr) 6px',
    });
    expect(container.querySelector('.rc-virtual-list-holder')).toHaveStyle({ height: '94px' });
  });

  it('adds the vertical scrollbar when the horizontal gutter reduces the viewport', async () => {
    holderHeight = 92;

    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(5),
      scrollWidth: 1000,
    });

    expect(container.querySelector('.rc-virtual-list-scrollbar-horizontal')).toBeTruthy();
    expect(container.querySelector('.rc-virtual-list-scrollbar-vertical')).toBeTruthy();
    expect(container.querySelector('.rc-virtual-list-holder')).toHaveStyle({ height: '92px' });
  });

  it('reserves the vertical gutter on the left in rtl', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
      direction: 'rtl',
    });

    expect(container.querySelector('.rc-virtual-list')).toHaveStyle({
      gridTemplateColumns: '8px minmax(0, 1fr)',
    });
    expect(container.querySelector('.rc-virtual-list-scrollbar-slot-vertical')).toHaveStyle({
      gridColumn: '1',
    });
    expect(container.querySelector('.rc-virtual-list-scrollbar-slot-horizontal')).toHaveStyle({
      gridColumn: '2',
    });
  });

  describe('trigger offset', () => {
    it('click horizontal track to scroll', async () => {
      const listRef = React.createRef<ListRef>();

      const { container } = await genList({
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(100),
        scrollWidth: 1000,
        ref: listRef,
      });

      pageX = 30;
      fireEvent.mouseDown(container.querySelector('.rc-virtual-list-scrollbar-horizontal')!);

      expect(listRef.current.getScrollInfo()).toEqual({ x: 225, y: 0 });
    });

    it('click horizontal track to scroll in rtl', async () => {
      const listRef = React.createRef<ListRef>();

      const { container } = await genList({
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(100),
        scrollWidth: 1000,
        direction: 'rtl',
        ref: listRef,
      });

      pageX = 30;
      fireEvent.mouseDown(container.querySelector('.rc-virtual-list-scrollbar-horizontal')!);

      expect(listRef.current.getScrollInfo()).toEqual({ x: -675, y: 0 });
    });

    it('drag scrollbar', async () => {
      const onVirtualScroll = jest.fn();
      const listRef = React.createRef<ListRef>();

      const props = {
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(100),
        scrollWidth: 1000,
        onVirtualScroll,
        ref: listRef,
      };

      const { container, rerender } = await genList(props);

      await act(async () => {
        onLibResize([
          {
            target: container.querySelector('.rc-virtual-list-holder')!,
          } as ResizeObserverEntry,
        ]);

        await Promise.resolve();
      });

      // Drag
      const thumb = container.querySelector(
        '.rc-virtual-list-scrollbar-horizontal .rc-virtual-list-scrollbar-thumb',
      )!;

      pageX = 10;
      fireEvent.mouseDown(thumb);

      pageX = 100000;
      fireEvent.mouseMove(window);

      act(() => {
        jest.runAllTimers();
      });

      fireEvent.mouseUp(window);

      expect(thumb).toHaveStyle({
        left: '80px',
        width: '20px',
      });

      expect(onVirtualScroll).toHaveBeenCalledWith({ x: 900, y: 0 });
      expect(listRef.current.getScrollInfo()).toEqual({ x: 900, y: 0 });

      act(() => {
        rerender(
          <List component="ul" itemKey="id" {...props} scrollWidth={600}>
            {({ id }) => <li>{id}</li>}
          </List>,
        );
      });
      expect(onVirtualScroll).toHaveBeenCalledWith({ x: 500, y: 0 });
      expect(listRef.current.getScrollInfo()).toEqual({ x: 500, y: 0 });
    });

    it('wheel', async () => {
      const onVirtualScroll = jest.fn();

      const { container } = await genList({
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(100),
        scrollWidth: 1000,
        onVirtualScroll,
      });

      // Wheel
      fireEvent.wheel(container.querySelector('.rc-virtual-list-holder')!, {
        deltaX: 123,
      });
      expect(onVirtualScroll).toHaveBeenCalledWith({ x: 123, y: 0 });
    });

    it('trigger event when less count', async () => {
      const onVirtualScroll = jest.fn();

      const { container } = await genList({
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(1),
        scrollWidth: 1000,
        onVirtualScroll,
      });

      // Wheel
      fireEvent.wheel(container.querySelector('.rc-virtual-list-holder')!, {
        deltaX: 123,
      });
      expect(onVirtualScroll).toHaveBeenCalledWith({ x: 123, y: 0 });
    });

    it('shift wheel', async () => {
      const onVirtualScroll = jest.fn();

      const { container } = await genList({
        itemHeight: ITEM_HEIGHT,
        height: 100,
        data: genData(100),
        scrollWidth: 1000,
        onVirtualScroll,
      });

      // Wheel
      fireEvent.wheel(container.querySelector('.rc-virtual-list-holder')!, {
        deltaY: 123,
        shiftKey: true,
      });
      expect(onVirtualScroll).toHaveBeenCalledWith({ x: 123, y: 0 });
    });
  });

  it('ref scrollTo', async () => {
    const listRef = React.createRef<ListRef>();

    await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
      ref: listRef,
    });

    act(() => {
      listRef.current.scrollTo({ left: 135 });
    });
    expect(listRef.current.getScrollInfo()).toEqual({ x: 135, y: 0 });

    act(() => {
      listRef.current.scrollTo({ left: -99 });
    });
    expect(listRef.current.getScrollInfo()).toEqual({ x: 0, y: 0 });
  });

  it('support extraRender', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
      extraRender: ({ getSize }) => {
        const size = getSize('1', '3');
        return (
          <div className="bamboo">
            {size.top}/{size.bottom}
          </div>
        );
      },
    });

    expect(container.querySelector('.rc-virtual-list-holder-inner .bamboo')).toBeTruthy();
    expect(container.querySelector('.bamboo').textContent).toEqual(
      `${ITEM_HEIGHT}/${4 * ITEM_HEIGHT}`,
    );
  });

  it('resize should back of scrollLeft', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
    });

    // Wheel
    fireEvent.wheel(container.querySelector('.rc-virtual-list-holder')!, {
      deltaX: 9999999,
    });

    holderWidth = 200;

    await act(async () => {
      onLibResize([
        {
          target: container.querySelector('.rc-virtual-list-holder')!,
        } as ResizeObserverEntry,
      ]);

      await Promise.resolve();
    });

    expect(container.querySelector('.rc-virtual-list-holder-inner')).toHaveStyle({
      marginLeft: '-800px',
    });
  });

  it('touch horizontal', async () => {
    const { container } = await genList({
      itemHeight: ITEM_HEIGHT,
      height: 100,
      data: genData(100),
      scrollWidth: 1000,
    });

    fireEvent.touchStart(container.querySelector('.rc-virtual-list-holder')!, {
      touches: [{ pageX: 100, pageY: 0 }],
    });

    fireEvent.touchMove(container.querySelector('.rc-virtual-list-holder')!, {
      touches: [{ pageX: 0, pageY: 0 }],
    });

    fireEvent.touchEnd(container.querySelector('.rc-virtual-list-holder')!, {
      touches: [{ pageX: 0, pageY: 0 }],
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(container.querySelector('.rc-virtual-list-holder-inner')).toHaveStyle({
      marginLeft: '-900px',
    });
  });
});
