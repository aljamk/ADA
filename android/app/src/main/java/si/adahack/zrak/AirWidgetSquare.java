package si.adahack.zrak;

/** The square widget (2 x 2); the data and rendering live in AirWidgetProvider. */
public class AirWidgetSquare extends AirWidgetProvider {
    @Override
    protected int layout() {
        return R.layout.widget_air_square;
    }
}
