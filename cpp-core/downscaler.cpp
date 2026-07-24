#include <emscripten/emscripten.h>
#include <cmath>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <cstdint>

extern "C" {

// Calculates Greatest Common Divisor
EMSCRIPTEN_KEEPALIVE
int get_gcd(int a, int b) {
    while (b != 0) {
        int temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

struct BinData {
    float weightedCount = 0.0f;
    double sumR = 0.0;
    double sumG = 0.0;
    double sumB = 0.0;
};

// Downscales raw RGBA pixels into a smaller pixel-art buffer
EMSCRIPTEN_KEEPALIVE
void process_image(
    const uint8_t* src, 
    int srcW, 
    int srcH, 
    float targetBlockSize, 
    uint8_t* dst, 
    int dstW, 
    int dstH
) {
    for (int dstY = 0; dstY < dstH; ++dstY) {
        float srcYStart = dstY * targetBlockSize;
        float srcYEnd = srcYStart + targetBlockSize;

        for (int dstX = 0; dstX < dstW; ++dstX) {
            float srcXStart = dstX * targetBlockSize;
            float srcXEnd = srcXStart + targetBlockSize;

            std::unordered_map<uint32_t, BinData> histogram;

            int yMin = static_cast<int>(std::floor(srcYStart));
            int yMax = static_cast<int>(std::min(static_cast<float>(srcH), std::ceil(srcYEnd)));
            int xMin = static_cast<int>(std::floor(srcXStart));
            int xMax = static_cast<int>(std::min(static_cast<float>(srcW), std::ceil(srcXEnd)));

            for (int y = yMin; y < yMax; ++y) {
                // Calculate vertical overlap for sub-pixel accuracy
                float overlapY = std::min(static_cast<float>(y + 1), srcYEnd) - std::max(static_cast<float>(y), srcYStart);
                if (overlapY <= 0.0f) continue;

                for (int x = xMin; x < xMax; ++x) {
                    // Calculate horizontal overlap for sub-pixel accuracy
                    float overlapX = std::min(static_cast<float>(x + 1), srcXEnd) - std::max(static_cast<float>(x), srcXStart);
                    if (overlapX <= 0.0f) continue;

                    float weight = overlapX * overlapY;
                    int srcIdx = (y * srcW + x) * 4;

                    uint8_t r = src[srcIdx];
                    uint8_t g = src[srcIdx + 1];
                    uint8_t b = src[srcIdx + 2];

                    // Quantize to 5-bit color space (32 levels per channel)
                    uint32_t key = ((r >> 3) << 16) | ((g >> 3) << 8) | (b >> 3);

                    auto& bin = histogram[key];
                    bin.weightedCount += weight;
                    bin.sumR += r * weight;
                    bin.sumG += g * weight;
                    bin.sumB += b * weight;
                }
            }

            // Extract winning dominant color mode
            float maxWeight = -1.0f;
            uint8_t outR = 0, outG = 0, outB = 0;

            for (const auto& [key, bin] : histogram) {
                if (bin.weightedCount > maxWeight) {
                    maxWeight = bin.weightedCount;
                    outR = static_cast<uint8_t>(bin.sumR / bin.weightedCount);
                    outG = static_cast<uint8_t>(bin.sumG / bin.weightedCount);
                    outB = static_cast<uint8_t>(bin.sumB / bin.weightedCount);
                }
            }

            int dstIdx = (dstY * dstW + dstX) * 4;
            dst[dstIdx]     = outR;
            dst[dstIdx + 1] = outG;
            dst[dstIdx + 2] = outB;
            dst[dstIdx + 3] = 255; // Fully opaque
        }
    }
}

}